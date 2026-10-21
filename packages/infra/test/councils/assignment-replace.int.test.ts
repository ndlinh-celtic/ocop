import { describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { scoringWorld } from "../scoring/world";

/*
 * L09 HD-03 (#55, spec #49 stories 34 to 39): after Giao chấm and until chốt điểm, the Thư ký hội đồng replaces a
 * thành viên chấm whose Phiếu chấm is not yet xác nhận, or a Thành viên Tổ tư vấn, with a reason (xung đột lợi ích
 * khai báo bằng văn bản), and adds thành viên chấm or Thành viên Tổ tư vấn. The old Phân công is kept, marked
 * replaced; the old nháp is superseded; the old person stops seeing the hồ sơ, the new one sees it at once with a
 * Phiếu chấm trống, and both hear of it. One person still never holds two roles on one hồ sơ.
 */
const REASON = "Xung đột lợi ích đã khai báo bằng văn bản ngày 20/10/2026";

describe("L09 thay và bổ sung thành viên chấm, chấm trực tiếp (#55)", () => {
  const w = scoringWorld({ minGraders: 2 });
  const m = (i: number) => w.A.members[i]!;
  const version = async (dossierId: string) => (await w.t.app.dossiers.get(w.A.secretary, { dossierId })).version;
  const sheetOf = async (actor: UserActor, dossierId: string) => {
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "own_sheet") throw new Error(`expected own_sheet, got ${view.kind}`);
    return view;
  };
  const scoreAll = async (actor: UserActor, dossierId: string) => {
    const lines = [
      ["1.1", 40],
      ["2.1", 25],
      ["3.1", 35],
    ].map(([code, points]) => ({ criterionId: w.criterionId(code as string), levelId: w.level(`${code}:${points}`), comment: "", evidenceFileIds: [] }));
    const { version } = await w.t.app.scoring.saveScoreSheet(actor, { dossierId, expectedVersion: (await sheetOf(actor, dossierId)).sheet!.version, lines });
    return w.t.app.scoring.confirmScoreSheet(actor, { dossierId, expectedVersion: version });
  };
  const replace = async (dossierId: string, userId: string, newUserId: string, reason = REASON) =>
    w.t.app.councils.replaceAssignment(w.A.secretary, { dossierId, expectedVersion: await version(dossierId), userId, newUserId, reason });
  const noticesOf = async (actor: UserActor, kind: string) => (await w.t.app.notifications.list(actor)).filter((n) => n.kind === kind).length;
  const add = async (dossierId: string, userId: string, kind: "member" | "advisory" = "member", reason = REASON) =>
    w.t.app.councils.addAssignment(w.A.secretary, { dossierId, expectedVersion: await version(dossierId), userId, kind, reason });

  it("replaces a thành viên chấm whose phiếu is a nháp: the old Phân công is kept as replaced and the nháp superseded (stories 34, 38)", async () => {
    const d = await w.graded([m(0), m(1)]);
    const old = (await sheetOf(m(1), d.dossierId)).sheet!;
    await w.t.app.scoring.saveScoreSheet(m(1), {
      dossierId: d.dossierId,
      expectedVersion: old.version,
      lines: [{ criterionId: w.criterionId("1.1"), levelId: w.level("1.1:20"), comment: "", evidenceFileIds: [] }],
    });

    await replace(d.dossierId, m(1).userId, m(2).userId);

    expect((await w.t.app.councils.assignments(w.A.secretary, { dossierId: d.dossierId })).map((a) => [a.userId, a.kind])).toEqual([
      [m(0).userId, "member"],
      [m(2).userId, "member"],
    ]);
    expect(await w.t.app.councils.assignmentHistory(w.A.secretary, { dossierId: d.dossierId })).toEqual([
      expect.objectContaining({ userId: m(1).userId, kind: "member", replacedAt: w.t.clock.now(), replacedBy: { userId: w.A.secretary.userId, fullName: w.A.secretary.fullName }, reason: REASON }),
    ]);
    const sheet = await w.db.admin.query("SELECT state, superseded_reason FROM scoring.score_sheet WHERE id = $1", [old.id]);
    expect(sheet.rows).toEqual([{ state: "superseded", superseded_reason: REASON }]);
  });

  it("takes the hồ sơ away from the person replaced and tells them (story 38)", async () => {
    const d = await w.graded([m(0), m(1)]);
    await w.t.drainJobs();
    const before = await noticesOf(m(1), "dossier_assignment_replaced");

    await replace(d.dossierId, m(1).userId, m(2).userId);

    await expect(w.t.app.dossiers.get(m(1), { dossierId: d.dossierId })).rejects.toMatchObject({ code: "not_found" });
    await expect(w.t.app.scoring.readDossierScores(m(1), { dossierId: d.dossierId })).rejects.toMatchObject({ code: "not_found" });
    expect((await w.t.app.dossiers.list(m(1), {})).map((x) => x.id)).not.toContain(d.dossierId);
    await w.t.drainJobs();
    expect(await noticesOf(m(1), "dossier_assignment_replaced")).toBe(before + 1);
    expect(w.t.mailbox.to(m(1).email).some((mail) => mail.subject.includes("không còn"))).toBe(true);
  });

  it("gives the new thành viên a Phân công in force at once, a Phiếu chấm trống and a notice (story 39)", async () => {
    const d = await w.graded([m(0), m(1)]);

    await replace(d.dossierId, m(1).userId, m(3).userId);

    expect(await w.t.app.dossiers.get(m(3), { dossierId: d.dossierId })).toMatchObject({ state: "member_review" });
    const view = await sheetOf(m(3), d.dossierId);
    expect(view.sheet).toMatchObject({ state: "draft", attempt: 1 });
    expect(view.unscored).toEqual(["1.1", "2.1", "3.1"]);
    await w.t.drainJobs();
    expect((await w.t.app.notifications.list(m(3))).filter((n) => n.kind === "dossier_assigned" && n.link === `/thanh-vien/ho-so/${d.dossierId}`)).toHaveLength(1);
    expect(w.t.mailbox.to(m(3).email).some((mail) => mail.subject.includes("Phân công"))).toBe(true);
  });

  it("is audited with the reason and the people, off the Chủ thể's timeline, in the same transaction as the outbox event", async () => {
    const d = await w.graded([m(0), m(1)]);

    await replace(d.dossierId, m(1).userId, m(2).userId);

    const [entry] = await w.t.app.audit.search(await w.f.admin(), { action: ["dossier.assignment.replace"], targetId: d.dossierId });
    expect(entry).toMatchObject({
      before: { state: "member_review" },
      after: { state: "member_review" },
      metadata: expect.objectContaining({ kind: "member", replacedUserId: m(1).userId, newUserId: m(2).userId, reason: REASON }),
    });
    const outbox = await w.db.admin.query("SELECT type FROM platform.outbox WHERE payload->>'dossierId' = $1 AND type LIKE '%assignment%' ORDER BY type", [d.dossierId]);
    // dossier.assignment_changed once for the Phân công nháp, once for the thay thế.
    expect(outbox.rows.map((r) => r.type)).toEqual(["council.assignment.replaced", "dossier.assignment_changed", "dossier.assignment_changed"]);
    expect((await w.t.app.dossiers.timeline(d.a, { dossierId: d.dossierId })).map((e) => e.action)).not.toContain("dossier.assignment.replace");
  });

  it("refuses to replace a thành viên whose phiếu is xác nhận (story 35)", async () => {
    const d = await w.graded([m(0), m(1)]);
    await scoreAll(m(1), d.dossierId);

    await expect(replace(d.dossierId, m(1).userId, m(2).userId)).rejects.toMatchObject({ code: "assignment_sheet_confirmed" });
    expect((await w.t.app.councils.assignments(w.A.secretary, { dossierId: d.dossierId })).map((a) => a.userId)).toEqual([m(0).userId, m(1).userId]);
  });

  it("requires a reason", async () => {
    const d = await w.graded([m(0), m(1)]);

    await expect(replace(d.dossierId, m(1).userId, m(2).userId, "  ")).rejects.toMatchObject({ code: "reason_required" });
    await expect(add(d.dossierId, m(2).userId, "member", "")).rejects.toMatchObject({ code: "reason_required" });
  });

  it("only takes someone with a Phân vai Thành viên hội đồng in force on the Hội đồng", async () => {
    const d = await w.graded([m(0), m(1)]);

    await expect(replace(d.dossierId, m(1).userId, w.B.members[0]!.userId)).rejects.toMatchObject({ code: "not_council_member" });
    await expect(add(d.dossierId, w.B.members[0]!.userId)).rejects.toMatchObject({ code: "not_council_member" });
  });

  it("refuses someone already Phân công on the hồ sơ, and someone who is not", async () => {
    const d = await w.graded([m(0), m(1)]);

    await expect(replace(d.dossierId, m(1).userId, m(0).userId)).rejects.toMatchObject({ code: "already_assigned" });
    await expect(add(d.dossierId, m(0).userId)).rejects.toMatchObject({ code: "already_assigned" });
    await expect(replace(d.dossierId, m(2).userId, m(3).userId)).rejects.toMatchObject({ code: "assignment_not_found" });
  });

  it("refuses a Thành viên Tổ tư vấn in chấm trực tiếp", async () => {
    const d = await w.graded([m(0), m(1)]);

    await expect(add(d.dossierId, w.A.advisors[0]!.userId, "advisory")).rejects.toMatchObject({ code: "advisory_assignment_in_direct_mode" });
  });

  it("refuses a stale version of the hồ sơ", async () => {
    const d = await w.graded([m(0), m(1)]);

    await expect(
      w.t.app.councils.replaceAssignment(w.A.secretary, { dossierId: d.dossierId, expectedVersion: d.version - 1, userId: m(1).userId, newUserId: m(2).userId, reason: REASON }),
    ).rejects.toMatchObject({ code: "version_conflict" });
  });

  it("adds a thành viên chấm after Giao chấm, also once the hồ sơ is Sẵn sàng chốt (story 37)", async () => {
    const d = await w.graded([m(0), m(1)]);
    await scoreAll(m(0), d.dossierId);
    expect((await scoreAll(m(1), d.dossierId)).dossierState).toBe("member_confirmed");
    await w.t.drainJobs();
    const before = await noticesOf(m(2), "dossier_assigned");

    await add(d.dossierId, m(2).userId);

    expect(await w.t.app.dossiers.get(m(2), { dossierId: d.dossierId })).toMatchObject({ state: "member_confirmed" });
    expect((await sheetOf(m(2), d.dossierId)).sheet).toMatchObject({ state: "draft", attempt: 1 });
    expect((await w.t.app.councils.assignments(w.A.secretary, { dossierId: d.dossierId })).map((a) => a.userId)).toEqual([m(0).userId, m(1).userId, m(2).userId]);
    await w.t.drainJobs();
    expect(await noticesOf(m(2), "dossier_assigned")).toBe(before + 1);
    // Thay a thành viên of a hồ sơ Sẵn sàng chốt while their phiếu is still a nháp.
    await replace(d.dossierId, m(2).userId, m(3).userId);
    expect((await sheetOf(m(3), d.dossierId)).sheet).toMatchObject({ state: "draft" });
  });
});

describe("L09 thay và bổ sung Thành viên Tổ tư vấn, chấm dựa trên Tổ tư vấn (#55)", () => {
  const w = scoringWorld({ gradingMode: "advisory_based", minGraders: 2, advisors: 3 });
  const m = (i: number) => w.A.members[i]!;
  const adv = (i: number) => w.A.advisors[i]!;
  const version = async (dossierId: string) => (await w.t.app.dossiers.get(w.A.secretary, { dossierId })).version;

  it("replaces a Thành viên Tổ tư vấn while Tổ tư vấn thẩm định: the old one loses the hồ sơ, the new one has it (story 36)", async () => {
    const d = await w.graded([m(0), m(1)], [adv(0)]);

    await w.t.app.councils.replaceAssignment(w.A.secretary, { dossierId: d.dossierId, expectedVersion: await version(d.dossierId), userId: adv(0).userId, newUserId: adv(1).userId, reason: REASON });

    await expect(w.t.app.dossiers.get(adv(0), { dossierId: d.dossierId })).rejects.toMatchObject({ code: "not_found" });
    expect(await w.t.app.dossiers.get(adv(1), { dossierId: d.dossierId })).toMatchObject({ state: "advisory_review" });
    await w.t.drainJobs();
    expect((await w.t.app.notifications.list(adv(0))).filter((n) => n.kind === "dossier_assignment_replaced")).toHaveLength(1);
    expect((await w.t.app.notifications.list(adv(1))).filter((n) => n.kind === "dossier_assigned" && n.link === "/to-tu-van/hang-doi")).toHaveLength(1);
  });

  it("adds a Thành viên Tổ tư vấn, and a thành viên chấm whose Phiếu chấm trống waits for the sao chép (stories 36, 37)", async () => {
    const d = await w.graded([m(0), m(1)], [adv(0)]);

    await w.t.app.councils.addAssignment(w.A.secretary, { dossierId: d.dossierId, expectedVersion: await version(d.dossierId), userId: adv(2).userId, kind: "advisory", reason: REASON });
    await w.t.app.councils.addAssignment(w.A.secretary, { dossierId: d.dossierId, expectedVersion: await version(d.dossierId), userId: m(2).userId, kind: "member", reason: REASON });

    expect((await w.t.app.councils.assignments(w.A.secretary, { dossierId: d.dossierId })).map((a) => [a.userId, a.kind, a.effectiveAt !== null])).toEqual([
      [m(0).userId, "member", true],
      [m(1).userId, "member", true],
      [adv(0).userId, "advisory", true],
      [adv(2).userId, "advisory", true],
      [m(2).userId, "member", true],
    ]);
    expect(await w.t.app.dossiers.get(adv(2), { dossierId: d.dossierId })).toMatchObject({ state: "advisory_review" });
    const sheets = await w.db.admin.query(
      "SELECT s.state FROM scoring.score_sheet s JOIN council.assignment a ON a.id = s.assignment_id WHERE a.dossier_id = $1 AND a.user_id = $2",
      [d.dossierId, m(2).userId],
    );
    expect(sheets.rows).toEqual([{ state: "draft" }]);
  });

  it("still refuses one person in two roles on the hồ sơ (CLAUDE.md)", async () => {
    const d = await w.graded([m(0), m(1)], [adv(0)]);
    // Thành viên 0 also holds a Phân vai Thành viên Tổ tư vấn on the Hội đồng.
    await w.f.grant(m(0), "advisory_member", w.A.councilId);
    const v = await version(d.dossierId);

    await expect(
      w.t.app.councils.addAssignment(w.A.secretary, { dossierId: d.dossierId, expectedVersion: v, userId: m(0).userId, kind: "advisory", reason: REASON }),
    ).rejects.toMatchObject({ code: "conflict_of_roles" });
    await expect(
      w.t.app.councils.replaceAssignment(w.A.secretary, { dossierId: d.dossierId, expectedVersion: v, userId: adv(0).userId, newUserId: m(1).userId, reason: REASON }),
    ).rejects.toMatchObject({ code: "conflict_of_roles" });
  });
});
