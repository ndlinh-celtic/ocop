import type { UserActor } from "@ocop/core";
import { describe, expect, it } from "vitest";
import { systemActor } from "../support";
import { FOUR, resultsWorld, THREE } from "./results-world";

/*
 * L16 (#86, spec #79 stories 32, 33, 35): a set number of months (6 by default) before a Giấy chứng nhận's ngày hết
 * hiệu lực, the Chủ thể and the Cán bộ Sở are reminded once, in the app and by email.
 */
describe("L16 nhắc Giấy chứng nhận sắp hết hiệu lực (#86)", () => {
  const { w, closedMeeting, record } = resultsWorld();
  const JOB = systemActor("results.certificate-expiry-reminders");
  const SUBJECT = "Nhắc Giấy chứng nhận OCOP sắp hết hiệu lực";

  /** 08:00 giờ Việt Nam on a calendar date. */
  const vnMorning = (date: string) => new Date(`${date}T01:00:00Z`);
  const run = async (date: string) => {
    w.t.clock.set(vnMorning(date));
    const result = await w.t.app.results.sendCertificateExpiryReminders(JOB);
    await w.t.drainJobs();
    return result;
  };
  const remindersOf = async (actor: UserActor, dossierId: string) =>
    (await w.t.app.notifications.list(actor)).filter((n) => n.kind === "certificate_expiry" && n.link?.endsWith(dossierId));
  const emailsOf = (actor: UserActor, dossierId: string) => w.t.mailbox.to(actor.email).filter((e) => e.subject === SUBJECT && e.text.includes(dossierId));

  /** One hồ sơ 3 sao and one 4 sao, of two Chủ thể, recognized by a quyết định signed on `signedOn`. */
  async function recognized(signedOn: string) {
    const { meetingId, dossiers } = await closedMeeting([THREE, FOUR]);
    const { decisionId } = await record(meetingId, w.province, { signedOn });
    await w.t.drainJobs();
    return { decisionId, dossiers: dossiers as [{ a: UserActor; dossierId: string }, { a: UserActor; dossierId: string }] };
  }

  it("reminds the Chủ thể and the Cán bộ Sở on the day 6 months before the ngày hết hiệu lực, once, about their own giấy only (stories 32, 33)", async () => {
    const { dossiers } = await recognized("2026-10-12"); // ngày hết hiệu lực 12/10/2029
    const [x, y] = dossiers;

    await run("2029-04-11");
    expect(await remindersOf(x.a, x.dossierId)).toEqual([]);
    expect(await remindersOf(w.province, x.dossierId)).toEqual([]);

    await run("2029-04-12");
    const [mine, ...more] = await remindersOf(x.a, x.dossierId);
    expect(more).toEqual([]);
    expect(mine).toMatchObject({ title: expect.stringContaining("12/10/2029"), link: `/chu-the/ho-so/${x.dossierId}` });
    expect(await remindersOf(x.a, y.dossierId)).toEqual([]);
    expect(await remindersOf(y.a, y.dossierId)).toHaveLength(1);
    expect(await remindersOf(y.a, x.dossierId)).toEqual([]);
    expect(await remindersOf(w.province, x.dossierId)).toMatchObject([{ link: `/so/ho-so/${x.dossierId}` }]);
    expect(await remindersOf(w.province, y.dossierId)).toHaveLength(1);
    expect(emailsOf(x.a, x.dossierId)).toHaveLength(1);
    expect(emailsOf(w.province, x.dossierId)).toHaveLength(1);

    await run("2029-04-12");
    await run("2029-05-20");
    expect(await remindersOf(x.a, x.dossierId)).toHaveLength(1);
    expect(await remindersOf(w.province, x.dossierId)).toHaveLength(1);
    expect(emailsOf(x.a, x.dossierId)).toHaveLength(1);
  });

  it("reminds by the new ngày hết hiệu lực when the ngày ký of the quyết định is corrected before the reminder", async () => {
    const { decisionId, dossiers } = await recognized("2026-10-05"); // hết hiệu lực 05/10/2029
    const [x] = dossiers;
    await w.t.app.results.amendDecision(w.province, { decisionId, number: "123/QĐ-UBND", signedOn: "2026-10-09", reason: "Sửa ngày ký" });
    await w.t.drainJobs();

    await run("2029-04-05");
    expect(await remindersOf(x.a, x.dossierId)).toEqual([]);

    await run("2029-04-09");
    expect(await remindersOf(x.a, x.dossierId)).toMatchObject([{ title: expect.stringContaining("09/10/2029") }]);
  });

  it("does not remind a giấy again when the ngày ký of its quyết định is corrected after the reminder", async () => {
    const { decisionId, dossiers } = await recognized("2026-10-15"); // hết hiệu lực 15/10/2029
    const [x] = dossiers;
    await run("2029-04-15");
    expect(await remindersOf(x.a, x.dossierId)).toHaveLength(1);

    await w.t.app.results.amendDecision(w.province, { decisionId, number: "123/QĐ-UBND", signedOn: "2026-10-20", reason: "Sửa ngày ký" });
    await w.t.drainJobs();
    await run("2029-04-20");
    await run("2029-06-01");
    expect(await remindersOf(x.a, x.dossierId)).toHaveLength(1);
    expect(await remindersOf(w.province, x.dossierId)).toHaveLength(1);
    expect(emailsOf(x.a, x.dossierId)).toHaveLength(1);
  });

  it("uses the number of months Quản trị sets, and a later change does not remind the same giấy again (story 35)", async () => {
    const admin = await w.f.admin();
    const settings = await w.t.app.system.certificateSettings(admin);
    const { dossiers } = await recognized("2026-10-02"); // hết hiệu lực 02/10/2029
    const [x] = dossiers;
    try {
      await w.t.app.system.setCertificateSettings(admin, { ...settings, expiryReminderMonths: 3 });
      await run("2029-04-02");
      expect(await remindersOf(x.a, x.dossierId)).toEqual([]);
      await run("2029-07-02");
      expect(await remindersOf(x.a, x.dossierId)).toHaveLength(1);

      await w.t.app.system.setCertificateSettings(admin, { ...settings, expiryReminderMonths: 2 });
      await run("2029-08-02");
      expect(await remindersOf(x.a, x.dossierId)).toHaveLength(1);
    } finally {
      await w.t.app.system.setCertificateSettings(admin, settings);
    }
  });
});
