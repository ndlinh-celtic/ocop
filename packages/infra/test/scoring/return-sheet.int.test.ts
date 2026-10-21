import { describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { scoringWorld } from "./world";

/*
 * L15 HD-05 Trả phiếu (#61, spec #49 stories 102 to 106, ADR 0008): before chốt, the Chủ tịch or Thư ký returns a
 * thành viên's phiếu đã xác nhận with a lý do. The old phiếu stays as it was, superseded; the thành viên gets
 * lần chấm attempt + 1 as a nháp prefilled from it, and hears why. When the phiếu đã xác nhận left fall below the
 * đợt's người chấm tối thiểu (2 here), the hồ sơ goes back from Sẵn sàng chốt to Thành viên xem xét.
 */
describe("L15 Trả phiếu (#61)", () => {
  const w = scoringWorld({ minGraders: 2 });
  const m = (i: number) => w.A.members[i]!;

  const own = async (actor: UserActor, dossierId: string) => {
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId, ownSheet: true });
    if (view.kind !== "own_sheet") throw new Error(`expected own_sheet, got ${view.kind}`);
    return view;
  };
  async function scoreAndConfirm(actor: UserActor, dossierId: string, [a, b, c]: [number, number, number] = [40, 25, 35], comment = "") {
    const lines = (
      [
        ["1.1", a],
        ["2.1", b],
        ["3.1", c],
      ] as const
    ).map(([code, points]) => ({ criterionId: w.criterionId(code), levelId: w.level(`${code}:${points}`), comment, evidenceFileIds: [] }));
    const { version } = await w.t.app.scoring.saveScoreSheet(actor, { dossierId, expectedVersion: (await own(actor, dossierId)).sheet!.version, lines });
    await w.t.app.scoring.confirmScoreSheet(actor, { dossierId, expectedVersion: version });
  }
  /** A hồ sơ Giao chấm to `graders` thành viên of Hội đồng A, of whom the first `confirmed` confirmed. */
  async function graded(graders: number, confirmed: number) {
    const d = await w.graded(Array.from({ length: graders }, (_, i) => m(i)));
    for (let i = 0; i < confirmed; i++) await scoreAndConfirm(m(i), d.dossierId, [20, 25, 35], `nhận xét ${i}`);
    return d;
  }
  const sheetOf = async (actor: UserActor, dossierId: string) => (await own(actor, dossierId)).sheet!;
  const stateOf = async (dossierId: string) => (await w.t.app.dossiers.get(w.A.secretary, { dossierId })).state;

  it("supersedes the phiếu đã xác nhận and opens lần chấm 2 as a nháp prefilled from it; three phiếu left two, so Sẵn sàng chốt stays (stories 102 to 104)", async () => {
    const d = await graded(3, 3);
    const old = await sheetOf(m(0), d.dossierId);
    const before = await own(m(0), d.dossierId);

    const result = await w.t.app.scoring.returnScoreSheet(w.A.chair, { dossierId: d.dossierId, sheetId: old.id, reason: "Xem lại tiêu chí 1.1 sau thảo luận" });

    expect(result).toMatchObject({ dossierState: "member_confirmed" });
    expect(await stateOf(d.dossierId)).toBe("member_confirmed");
    const view = await own(m(0), d.dossierId);
    expect(view.sheet).toMatchObject({ id: result.scoreSheetId, state: "draft", attempt: 2, version: 1, confirmedAt: null, reauthMethod: null });
    expect(view.criteria.map((c) => [c.code, c.levelId, c.comment, c.source, c.edited])).toEqual(
      before.criteria.map((c) => [c.code, c.levelId, c.comment, c.source, c.edited]),
    );
    expect(view.criteria.map((c) => c.points)).toEqual([20, 25, 35]);
  });

  it("takes the hồ sơ back to Thành viên xem xét when the phiếu đã xác nhận left fall below người chấm tối thiểu (story 105)", async () => {
    const d = await graded(2, 2);
    expect(await stateOf(d.dossierId)).toBe("member_confirmed");

    const result = await w.t.app.scoring.returnScoreSheet(w.A.secretary, { dossierId: d.dossierId, sheetId: (await sheetOf(m(1), d.dossierId)).id, reason: "Chấm lại" });

    expect(result.dossierState).toBe("member_review");
    expect(await stateOf(d.dossierId)).toBe("member_review");
    // Xác nhận again brings it back to Sẵn sàng chốt.
    await scoreAndConfirm(m(1), d.dossierId);
    expect(await stateOf(d.dossierId)).toBe("member_confirmed");
  });

  it("returns a phiếu đã xác nhận while the hồ sơ is still Thành viên xem xét; it stays there", async () => {
    const d = await graded(3, 1);

    const result = await w.t.app.scoring.returnScoreSheet(w.A.chair, { dossierId: d.dossierId, sheetId: (await sheetOf(m(0), d.dossierId)).id, reason: "Chấm lại" });

    expect(result.dossierState).toBe("member_review");
    expect((await sheetOf(m(0), d.dossierId)).attempt).toBe(2);
  });

  it("keeps the old phiếu as it was, superseded with its lý do, in the lịch sử the Chủ tịch and Thư ký alone read (story 104)", async () => {
    const d = await graded(3, 3);
    const old = await sheetOf(m(0), d.dossierId);
    const { scoreSheetId } = await w.t.app.scoring.returnScoreSheet(w.A.chair, { dossierId: d.dossierId, sheetId: old.id, reason: "Xem lại 1.1" });
    // The thành viên changes the new lần chấm; the old one must not follow.
    await w.t.app.scoring.saveScoreSheet(m(0), {
      dossierId: d.dossierId,
      expectedVersion: 1,
      lines: [{ criterionId: w.criterionId("1.1"), levelId: w.level("1.1:40"), comment: "đã sửa", evidenceFileIds: [] }],
    });

    for (const reader of [w.A.chair, w.A.secretary]) {
      const history = await w.t.app.scoring.scoreSheetHistory(reader, { dossierId: d.dossierId });
      expect(history).toEqual([
        expect.objectContaining({ sheetId: old.id, userId: m(0).userId, attempt: 1, confirmedAt: old.confirmedAt, reason: "Xem lại 1.1", total: 80 }),
      ]);
      expect(history[0]!.lines.map((l) => [l.code, l.points, l.comment])).toEqual([
        ["1.1", 20, "nhận xét 0"],
        ["2.1", 25, "nhận xét 0"],
        ["3.1", 35, "nhận xét 0"],
      ]);
    }
    const row = await w.db.admin.query("SELECT state, superseded_by, superseded_reason, version, updated_at, reauth_method FROM scoring.score_sheet WHERE id = $1", [old.id]);
    expect(row.rows[0]).toMatchObject({ state: "superseded", superseded_by: scoreSheetId, superseded_reason: "Xem lại 1.1", version: old.version, reauth_method: "password" });
    for (const other of [m(0), m(1), w.A.advisors[0]!]) {
      await expect(w.t.app.scoring.scoreSheetHistory(other, { dossierId: d.dossierId })).rejects.toMatchObject({ code: "forbidden" });
    }
  });

  it("keeps a returned phiếu in the lịch sử after its thành viên is thay, and leaves out the nháp the thay superseded (#55)", async () => {
    const d = await graded(3, 3);
    const old = await sheetOf(m(0), d.dossierId);
    await w.t.app.scoring.returnScoreSheet(w.A.chair, { dossierId: d.dossierId, sheetId: old.id, reason: "Chấm lại" });
    const { version } = await w.t.app.dossiers.get(w.A.secretary, { dossierId: d.dossierId });
    await w.t.app.councils.replaceAssignment(w.A.secretary, { dossierId: d.dossierId, expectedVersion: version, userId: m(0).userId, newUserId: m(3).userId, reason: "Bận" });

    const history = await w.t.app.scoring.scoreSheetHistory(w.A.secretary, { dossierId: d.dossierId });

    expect(history.map((h) => [h.sheetId, h.userId, h.attempt, h.reason])).toEqual([[old.id, m(0).userId, 1, "Chấm lại"]]);
    // The newcomer's phiếu trống is theirs to grade; a Trả phiếu of another's phiếu still counts only Phân công in force.
    expect(await sheetOf(m(3), d.dossierId)).toMatchObject({ state: "draft", attempt: 1 });
    expect(await stateOf(d.dossierId)).toBe("member_confirmed");
    await w.t.app.scoring.returnScoreSheet(w.A.chair, { dossierId: d.dossierId, sheetId: (await sheetOf(m(1), d.dossierId)).id, reason: "Chấm lại" });
    expect(await stateOf(d.dossierId)).toBe("member_review");
  });

  it("hides the lần chấm in progress from the other thành viên and shows it without points to the Chủ tịch (story 106)", async () => {
    const d = await graded(3, 3);
    await w.t.app.scoring.returnScoreSheet(w.A.chair, { dossierId: d.dossierId, sheetId: (await sheetOf(m(0), d.dossierId)).id, reason: "Chấm lại" });

    for (const reader of [m(1), w.A.chair]) {
      const view = await w.t.app.scoring.readDossierScores(reader, { dossierId: d.dossierId });
      if (view.kind !== "full") throw new Error(`expected full, got ${view.kind}`);
      expect(view.graders.find((g) => g.userId === m(0).userId)).toMatchObject({ state: "draft", total: null, lines: null });
      expect(view.aggregate.sheetCount).toBe(2);
    }
    expect((await w.t.app.scoring.readDossierScores(m(0), { dossierId: d.dossierId })).kind).toBe("own_sheet");
  });

  it("refuses a nháp, a phiếu already returned, another hồ sơ's phiếu and a missing lý do", async () => {
    const d = await graded(3, 2);
    const other = await graded(2, 2);
    const draft = await sheetOf(m(2), d.dossierId);
    const confirmed = await sheetOf(m(0), d.dossierId);
    const ret = (sheetId: string, reason = "Chấm lại") => w.t.app.scoring.returnScoreSheet(w.A.secretary, { dossierId: d.dossierId, sheetId, reason });

    await expect(ret(draft.id)).rejects.toMatchObject({ code: "score_sheet_not_returnable" });
    await expect(ret(confirmed.id, "   ")).rejects.toMatchObject({ code: "reason_required" });
    await expect(ret((await sheetOf(m(0), other.dossierId)).id)).rejects.toMatchObject({ code: "score_sheet_not_found" });
    await ret(confirmed.id);
    await expect(ret(confirmed.id)).rejects.toMatchObject({ code: "score_sheet_not_found" });
    expect((await sheetOf(m(0), d.dossierId)).attempt).toBe(2);
  });

  it("returns a phiếu Vắng, so that its thành viên grades for the first time (spec #49, after Mở khóa sau chốt)", async () => {
    const d = await graded(3, 2);
    const absent = await sheetOf(m(2), d.dossierId);
    // Chốt (#60) marks the nháp Vắng; until a Mở khóa (#63) brings the hồ sơ back, set it by hand.
    await w.db.admin.query("UPDATE scoring.score_sheet SET state = 'absent' WHERE id = $1", [absent.id]);

    const result = await w.t.app.scoring.returnScoreSheet(w.A.chair, { dossierId: d.dossierId, sheetId: absent.id, reason: "Vắng ở Phiên họp, chấm bổ sung" });

    expect(result.dossierState).toBe("member_confirmed");
    expect(await sheetOf(m(2), d.dossierId)).toMatchObject({ id: result.scoreSheetId, state: "draft", attempt: 2 });
  });

  it("tells the thành viên why in the app, by email only with a link, and is audited with outbox, off the Chủ thể's timeline (story 103)", async () => {
    const d = await graded(3, 3);
    const old = await sheetOf(m(0), d.dossierId);
    await w.t.app.scoring.returnScoreSheet(w.A.chair, { dossierId: d.dossierId, sheetId: old.id, reason: "Lý do riêng tư của hội đồng" });
    await w.t.drainJobs();

    const notices = (await w.t.app.notifications.list(m(0))).filter((n) => n.kind === "dossier_score_sheet_returned" && n.link === `/thanh-vien/ho-so/${d.dossierId}`);
    expect(notices).toHaveLength(1);
    expect(notices[0]!.body).toContain("Lý do riêng tư của hội đồng");
    const email = w.t.mailbox.to(m(0).email).at(-1)!;
    expect(email.text).toContain(`/thanh-vien/ho-so/${d.dossierId}`);
    expect(email.text).not.toContain("Lý do riêng tư");
    expect((await w.t.app.notifications.list(m(1))).filter((n) => n.kind === "dossier_score_sheet_returned" && n.link?.includes(d.dossierId))).toEqual([]);

    const [row] = await w.t.app.audit.search(await w.f.admin(), { action: ["dossier.score_sheet.return"], targetId: d.dossierId });
    expect(row).toMatchObject({ actorUserId: w.A.chair.userId, actorRole: "council_chair", metadata: { scoreSheetId: old.id, reason: "Lý do riêng tư của hội đồng" } });
    const outbox = await w.db.admin.query("SELECT type FROM platform.outbox WHERE payload->>'dossierId' = $1 AND type IN ('dossier.score_sheet_returned', 'scoring.score_sheet_returned')", [d.dossierId]);
    expect(outbox.rows.map((r) => r.type).sort()).toEqual(["dossier.score_sheet_returned", "scoring.score_sheet_returned"]);
    const timeline = JSON.stringify(await w.t.app.dossiers.timeline(d.a, { dossierId: d.dossierId }));
    expect(timeline).not.toContain("score_sheet.return");
    expect(timeline).not.toContain("Lý do riêng tư");
  });
});
