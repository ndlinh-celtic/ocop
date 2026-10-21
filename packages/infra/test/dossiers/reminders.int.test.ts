import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "./fixtures";

let db: TestDatabase;
let t: TestApp;
let wardX: string;
let wardY: string;
let wardZ: string;
let f: ReturnType<typeof fixtures>;
let versionId: string;
let sets: Record<"Rau củ quả" | "Thịt tươi", string>;
let admin: UserActor;
// 19/10/2026 09:00 giờ Việt Nam. The fixture round: Hạn nộp xã 30/11/2026, Hạn gửi tỉnh 15/12/2026.
const START = new Date("2026-10-19T02:00:00Z");
const JOB = systemActor("dossiers.due-reminders");

/** 08:00 giờ Việt Nam on a calendar date. */
const vnMorning = (date: string) => new Date(`${date}T01:00:00Z`);

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n00002,Xã Bình Lợi\n00003,Xã Cửu Long\n");
  const wards = await t.app.org.listWards();
  wardX = wards.find((w) => w.name === "Xã An Phú")!.id;
  wardY = wards.find((w) => w.name === "Xã Bình Lợi")!.id;
  wardZ = wards.find((w) => w.name === "Xã Cửu Long")!.id;
  f = fixtures(t, () => wardX);
  t.clock.set(START);
  ({ versionId, sets } = await f.publishedVersion("26/2026/QĐ-TTg"));
  await f.openRound(versionId);
  admin = await f.admin();
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

/** The reminders a Người dùng holds in the app, oldest first, after the outbox is drained. */
async function remindersOf(actor: UserActor) {
  await t.drainJobs();
  return (await t.app.notifications.list(actor)).filter((n) => n.kind === "dossier_reminder").sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
}

describe("CT-12 nhắc Hạn nộp xã (stories 36, 38)", () => {
  it("reminds a Chủ thể with a Nháp on the open đợt's Phiên bản tiêu chí at each mốc, once, by email and in the app", async () => {
    const a = await f.verifiedOwner();
    await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    await t.app.dossiers.create(a, { criteriaSetId: sets["Thịt tươi"] });
    const done = await f.submitted(sets["Rau củ quả"]);

    t.clock.set(vnMorning("2026-10-30")); // 31 days ahead: no mốc yet
    await t.app.dossiers.sendDueReminders(JOB);
    expect(await remindersOf(a)).toEqual([]);

    t.clock.set(vnMorning("2026-10-31")); // 30 days ahead
    expect((await t.app.dossiers.sendDueReminders(JOB)).sent).toBeGreaterThan(0);
    expect(await t.app.dossiers.sendDueReminders(JOB)).toEqual({ sent: 0 });
    const [first, ...rest] = await remindersOf(a);
    expect(rest).toEqual([]);
    expect(first).toMatchObject({ title: expect.stringContaining("Hạn nộp xã 30/11/2026"), link: "/chu-the/ho-so" });
    const emails = t.mailbox.to(a.email).filter((e) => e.subject === "Nhắc Hạn nộp xã hồ sơ OCOP");
    expect(emails).toHaveLength(1);
    expect(emails[0]!.text).toContain("còn 30 ngày");
    expect(await remindersOf(done.a)).toEqual([]);

    t.clock.set(vnMorning("2026-11-03")); // later the same mốc: nothing new
    await t.app.dossiers.sendDueReminders(JOB);
    expect(await remindersOf(a)).toHaveLength(1);
  });

  it("sends only the nearest mốc reached when the job first sees the hạn late, and the hạn day itself still counts", async () => {
    const a = await f.verifiedOwner();
    await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });

    t.clock.set(vnMorning("2026-11-20")); // 10 days ahead: the 14-day mốc, not the 30-day one
    await t.app.dossiers.sendDueReminders(JOB);
    await t.drainJobs();
    t.clock.set(vnMorning("2026-11-30")); // the hạn day: the 1-day mốc
    await t.app.dossiers.sendDueReminders(JOB);
    await t.drainJobs();
    t.clock.set(new Date("2026-11-30T16:59:59Z"));
    await t.app.dossiers.sendDueReminders(JOB);

    const titles = (await remindersOf(a)).map((n) => n.title);
    expect(titles).toEqual([expect.stringMatching(/^Còn 10 ngày/), expect.stringMatching(/^Hôm nay là hạn/)]);
    const [entry] = await t.app.audit.search(admin, { action: ["dossier.reminder_sent"], targetId: a.activeScope!.id! });
    expect(entry).toMatchObject({ actorRole: "system:dossiers.due-reminders", metadata: { kind: "submission", milestoneDays: 1, daysLeft: 0 } });
  });

  it("uses the mốc Quản trị sets", async () => {
    const a = await f.verifiedOwner();
    await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    await t.app.system.setReminderMilestones(admin, { days: [40] });
    try {
      t.clock.set(vnMorning("2026-10-21")); // 40 days ahead
      await t.app.dossiers.sendDueReminders(JOB);
      expect(await remindersOf(a)).toHaveLength(1);
    } finally {
      await t.app.system.setReminderMilestones(admin, { days: [30, 14, 7, 1] });
    }
  });
});

describe("CT-12 nhắc hạn bổ sung (story 55)", () => {
  it("reminds the Chủ thể of a hồ sơ Yêu cầu bổ sung at each mốc before its hạn bổ sung, once each", async () => {
    const officer = await f.staff("ward_officer", wardX);
    const s = await f.submitted(sets["Rau củ quả"]);
    const { version } = await t.app.dossiers.receive(officer, { dossierId: s.dossierId, expectedVersion: s.version });
    await t.app.dossiers.requestSupplement(officer, { dossierId: s.dossierId, expectedVersion: version, deadline: "2026-10-31", items: [{ content: "Bổ sung phiếu kiểm nghiệm" }] });

    await t.app.dossiers.sendDueReminders(JOB); // 12 days ahead: the 14-day mốc
    await t.drainJobs();
    await t.app.dossiers.sendDueReminders(JOB);
    t.clock.set(vnMorning("2026-10-24")); // 7 days ahead
    await t.app.dossiers.sendDueReminders(JOB);

    const reminders = await remindersOf(s.a);
    expect(reminders.map((n) => n.title)).toEqual(["Còn 12 ngày bổ sung hồ sơ Bưởi da xanh An Phú", "Còn 7 ngày bổ sung hồ sơ Bưởi da xanh An Phú"]);
    expect(reminders[0]).toMatchObject({ body: expect.stringContaining("31/10/2026"), link: `/chu-the/ho-so/${s.dossierId}` });
    expect(t.mailbox.to(s.a.email).filter((e) => e.subject === "Nhắc hạn bổ sung hồ sơ OCOP")).toHaveLength(2);
  });
});

describe("CT-12 nhắc Hạn gửi tỉnh (story 71)", () => {
  it("reminds the Cán bộ xã of each xã still holding hồ sơ of the đợt not gửi tỉnh, with how many, once per mốc", async () => {
    const officerY = await f.staff("ward_officer", wardY);
    const officerZ = await f.staff("ward_officer", wardZ);
    await f.submitted(sets["Rau củ quả"], wardY);
    await f.submitted(sets["Thịt tươi"], wardY);

    t.clock.set(vnMorning("2026-12-08")); // 7 days before Hạn gửi tỉnh 15/12/2026
    await t.app.dossiers.sendDueReminders(JOB);
    await t.app.dossiers.sendDueReminders(JOB);

    const [reminder, ...rest] = await remindersOf(officerY);
    expect(rest).toEqual([]);
    expect(reminder).toMatchObject({
      title: "Còn 7 ngày gửi tỉnh: Hạn gửi tỉnh 15/12/2026",
      body: expect.stringContaining("Xã còn 2 hồ sơ"),
      link: "/xa/ho-so",
    });
    expect(t.mailbox.to(officerY.email).filter((e) => e.subject === "Nhắc Hạn gửi tỉnh hồ sơ OCOP")).toHaveLength(1);
    expect(await remindersOf(officerZ)).toEqual([]);
  });
});

describe("CT-12 mốc nhắc hạn (story 37)", () => {
  it("starts at 30, 14, 7 and 1 ngày, and Quản trị changes them for the whole system, audited", async () => {
    expect(await t.app.system.reminderMilestones(admin)).toEqual({ days: [30, 14, 7, 1] });

    t.clock.set(new Date("2026-10-19T03:00:00Z"));
    await t.app.system.setReminderMilestones(admin, { days: [3, 10, 21] });

    expect(await t.app.system.reminderMilestones(admin)).toEqual({ days: [21, 10, 3] });
    const at = new Date("2026-10-19T03:00:00Z");
    const [entry] = await t.app.audit.search(admin, { action: ["system.reminder_milestones_changed"], from: at, to: new Date(at.getTime() + 1000) });
    expect(entry).toMatchObject({ actorUserId: admin.userId, before: { days: [30, 14, 7, 1] }, after: { days: [21, 10, 3] } });
    t.clock.set(START);
    await t.app.system.setReminderMilestones(admin, { days: [30, 14, 7, 1] });
  });

  it.each([[[]], [[0]], [[7, 7]], [[1.5]], [[400]], [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]]])("refuses %j", async (days) => {
    await expect(t.app.system.setReminderMilestones(admin, { days })).rejects.toMatchObject({ code: "invalid_reminder_milestones" });
  });

  it("is for Quản trị only", async () => {
    const officer = await f.staff("ward_officer", wardX);
    await expect(t.app.system.reminderMilestones(officer)).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.system.setReminderMilestones(officer, { days: [5] })).rejects.toMatchObject({ code: "forbidden" });
  });
});
