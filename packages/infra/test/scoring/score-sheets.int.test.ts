import { describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { minutes } from "../support";
import { scoringWorld } from "./world";

/*
 * L14 TV-01, TV-05, TV-06, TV-07 (#54, spec #49 stories 78, 82, 83, 86 to 92, 94 to 96): a thành viên chấm picks a
 * Mức điểm per Tiêu chí, writes nhận xét, attaches bằng chứng kiểm tra and saves a nháp, seeing Phần A/B/C, tổng
 * and Hạng sao ước lượng; then xác nhận after Xác thực lại. When the phiếu đã xác nhận reach the đợt's người chấm
 * tối thiểu, the hồ sơ is Sẵn sàng chốt and the Chủ tịch and Thư ký hear of it. Until then nobody sees another's points.
 */
describe("L14 Phiếu chấm and xác nhận (#54)", () => {
  const w = scoringWorld({ minGraders: 2 });
  const m = (i: number) => w.A.members[i]!;

  const own = async (actor: UserActor, dossierId: string) => {
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "own_sheet") throw new Error(`expected own_sheet, got ${view.kind}`);
    return view;
  };
  const save = (actor: UserActor, dossierId: string, expectedVersion: number, lines: { code: string; points: number | null; comment?: string; fileIds?: string[] }[]) =>
    w.t.app.scoring.saveScoreSheet(actor, {
      dossierId,
      expectedVersion,
      lines: lines.map((l) => ({
        criterionId: w.criterionId(l.code),
        levelId: l.points === null ? null : w.level(`${l.code}:${l.points}`),
        comment: l.comment ?? "",
        evidenceFileIds: l.fileIds ?? [],
      })),
    });
  const FULL = [
    { code: "1.1", points: 40 },
    { code: "2.1", points: 25 },
    { code: "3.1", points: 35 },
  ];
  /** Scores every Tiêu chí and confirms, within the Xác thực lại window of the sign-in. */
  async function scoreAndConfirm(actor: UserActor, dossierId: string, lines = FULL) {
    const { version } = await save(actor, dossierId, (await own(actor, dossierId)).sheet!.version, lines);
    return w.t.app.scoring.confirmScoreSheet(actor, { dossierId, expectedVersion: version });
  }

  it("opens on a Phiếu chấm trống: every Tiêu chí unscored, with its Mức điểm including Không đáp ứng, 0 điểm (stories 82, 83)", async () => {
    const d = await w.graded([m(0), m(1)]);

    const view = await own(m(0), d.dossierId);

    expect(view.sheet).toMatchObject({ state: "draft", attempt: 1, version: 1, confirmedAt: null });
    expect(view.criteria.map((c) => [c.code, c.partCode, c.levelId])).toEqual([
      ["1.1", "A", null],
      ["2.1", "B", null],
      ["3.1", "C", null],
    ]);
    expect(view.criteria.every((c) => c.levels.some((l) => l.points === 0))).toBe(true);
    expect(view.unscored).toEqual(["1.1", "2.1", "3.1"]);
    expect(view.estimate).toMatchObject({ total: 0, star: 1 });
  });

  it("saves Mức điểm and nhận xét as a nháp and estimates Phần A/B/C, tổng and Hạng sao (stories 86 to 88)", async () => {
    const d = await w.graded([m(0), m(1)]);

    const first = await save(m(0), d.dossierId, 1, [{ code: "1.1", points: 20, comment: "Thiếu hồ sơ quy trình" }]);
    const { version } = await save(m(0), d.dossierId, first.version, [
      { code: "2.1", points: 25 },
      { code: "3.1", points: 35 },
    ]);

    expect(version).toBe(3);
    const view = await own(m(0), d.dossierId);
    expect(view.criteria.map((c) => [c.code, c.points, c.comment])).toEqual([
      ["1.1", 20, "Thiếu hồ sơ quy trình"],
      ["2.1", 25, ""],
      ["3.1", 35, ""],
    ]);
    expect(view.estimate.parts).toEqual([
      { code: "A", total: 20 },
      { code: "B", total: 25 },
      { code: "C", total: 35 },
    ]);
    expect(view.estimate).toMatchObject({ total: 80, byThreshold: 4, star: 4 });
    expect(view.unscored).toEqual([]);

    // A Mức điểm can be cleared again, and "Không đáp ứng" is a Mức điểm like any other.
    await save(m(0), d.dossierId, version, [
      { code: "1.1", points: 0 },
      { code: "3.1", points: null },
    ]);
    const again = await own(m(0), d.dossierId);
    expect(again.estimate).toMatchObject({ total: 25, star: 1 });
    expect(again.unscored).toEqual(["3.1"]);
  });

  it("is audited with outbox in the same transaction, off the Chủ thể's timeline", async () => {
    const d = await w.graded([m(0), m(1)]);
    await save(m(0), d.dossierId, 1, [{ code: "1.1", points: 20 }]);

    const [row] = await w.t.app.audit.search(await w.f.admin(), { action: ["dossier.score_sheet.edit"], targetId: d.dossierId });
    expect(row).toMatchObject({ actorUserId: m(0).userId, actorRole: "council_member", metadata: { criterionIds: [w.criterionId("1.1")] } });
    const outbox = await w.db.admin.query("SELECT count(*)::int AS n FROM platform.outbox WHERE type = 'dossier.score_sheet_saved' AND payload->>'dossierId' = $1", [d.dossierId]);
    expect(outbox.rows[0].n).toBe(1);
    const timeline = await w.t.app.dossiers.timeline(d.a, { dossierId: d.dossierId });
    expect(timeline.map((e) => e.action)).not.toContain("dossier.score_sheet.edit");
  });

  it("refuses a Mức điểm of another Tiêu chí, a Tiêu chí of another Bộ, and a stale phiếu", async () => {
    const d = await w.graded([m(0), m(1)]);
    await expect(
      w.t.app.scoring.saveScoreSheet(m(0), { dossierId: d.dossierId, expectedVersion: 1, lines: [{ criterionId: w.criterionId("1.1"), levelId: w.level("2.1:25"), comment: "", evidenceFileIds: [] }] }),
    ).rejects.toMatchObject({ code: "level_not_in_criterion" });
    await expect(
      w.t.app.scoring.saveScoreSheet(m(0), { dossierId: d.dossierId, expectedVersion: 1, lines: [{ criterionId: crypto.randomUUID(), levelId: null, comment: "", evidenceFileIds: [] }] }),
    ).rejects.toMatchObject({ code: "criterion_not_in_set" });

    await save(m(0), d.dossierId, 1, [{ code: "1.1", points: 20 }]);
    await expect(save(m(0), d.dossierId, 1, [{ code: "1.1", points: 40 }])).rejects.toMatchObject({ code: "version_conflict" });
  });

  it("attaches bằng chứng kiểm tra of the thành viên's own uploads, never someone else's (story 86)", async () => {
    const d = await w.graded([m(0), m(1)]);
    const fileId = await w.f.uploadPdf(m(0), "grading_evidence", "Ảnh kiểm tra.pdf");
    const theirs = await w.f.uploadPdf(m(1), "grading_evidence", "Của người khác.pdf");

    const { version } = await save(m(0), d.dossierId, 1, [{ code: "1.1", points: 20, fileIds: [fileId] }]);

    expect((await own(m(0), d.dossierId)).criteria[0]!.files).toEqual([{ fileId, fileName: "Ảnh kiểm tra.pdf", status: "clean" }]);
    await expect(save(m(0), d.dossierId, version, [{ code: "1.1", points: 20, fileIds: [theirs] }])).rejects.toMatchObject({ code: "file_not_found" });
    expect((await w.t.app.files.requestDownload(m(0), { fileId })).url).toMatch(/^http/);
    await expect(w.t.app.files.requestDownload(m(1), { fileId })).rejects.toMatchObject({ code: "not_found" });
  });

  it("refuses xác nhận while a Tiêu chí has no Mức điểm, naming them (story 90)", async () => {
    const d = await w.graded([m(0), m(1)]);
    const { version } = await save(m(0), d.dossierId, 1, [{ code: "1.1", points: 20 }]);

    await expect(w.t.app.scoring.confirmScoreSheet(m(0), { dossierId: d.dossierId, expectedVersion: version })).rejects.toMatchObject({
      code: "score_sheet_incomplete",
      criteria: ["2.1", "3.1"],
    });
  });

  it("asks for Xác thực lại after 5 minutes, then confirms and records the method on the phiếu and the audit (story 89, 134)", async () => {
    const d = await w.graded([m(0), m(1)]);
    const { version } = await save(m(0), d.dossierId, 1, FULL);
    w.t.clock.advance(minutes(6));

    await expect(w.t.app.scoring.confirmScoreSheet(m(0), { dossierId: d.dossierId, expectedVersion: version })).rejects.toMatchObject({ code: "reauth_required" });
    expect(await w.t.app.identity.reauthenticate(m(0), { password: "mat-khau-nguoi-dung-1" })).toEqual({ ok: true });
    const result = await w.t.app.scoring.confirmScoreSheet(m(0), { dossierId: d.dossierId, expectedVersion: version });

    expect(result).toMatchObject({ version: version + 1, dossierState: "member_review" });
    expect((await own(m(0), d.dossierId)).sheet).toMatchObject({ state: "confirmed", confirmedAt: w.t.clock.now(), reauthMethod: "password" });
    const [row] = await w.t.app.audit.search(await w.f.admin(), { action: ["dossier.score_sheet.confirm"], targetId: d.dossierId });
    expect(row).toMatchObject({ actorUserId: m(0).userId, metadata: { reauth: { method: "password" } } });
  });

  it("keeps a phiếu đã xác nhận as it is (story 91)", async () => {
    const d = await w.graded([m(0), m(1)]);
    const { version } = await scoreAndConfirm(m(0), d.dossierId);

    await expect(save(m(0), d.dossierId, version, [{ code: "1.1", points: 20 }])).rejects.toMatchObject({ code: "score_sheet_confirmed" });
    await expect(w.t.app.scoring.confirmScoreSheet(m(0), { dossierId: d.dossierId, expectedVersion: version })).rejects.toMatchObject({ code: "score_sheet_confirmed" });
  });

  it("moves the hồ sơ to Thành viên xác nhận at người chấm tối thiểu and tells the Chủ tịch and Thư ký (story 96)", async () => {
    const d = await w.graded([m(0), m(1), m(2)]);
    expect((await scoreAndConfirm(m(0), d.dossierId)).dossierState).toBe("member_review");

    expect((await scoreAndConfirm(m(1), d.dossierId)).dossierState).toBe("member_confirmed");

    expect(await w.t.app.dossiers.get(w.A.secretary, { dossierId: d.dossierId })).toMatchObject({ state: "member_confirmed" });
    const [moved] = await w.t.app.audit.search(await w.f.admin(), { action: ["dossier.score_sheet.confirm_ready"], targetId: d.dossierId });
    expect(moved).toMatchObject({ before: { state: "member_review" }, after: { state: "member_confirmed" } });
    await w.t.drainJobs();
    for (const who of [w.A.chair, w.A.secretary]) {
      const notices = await w.t.app.notifications.list(who);
      expect(notices.map((n) => n.kind)).toContain("dossier_members_confirmed");
      expect(w.t.mailbox.to(who.email).some((mail) => mail.subject.includes("Sẵn sàng chốt"))).toBe(true);
    }
    expect((await w.t.app.notifications.list(m(2))).map((n) => n.kind)).not.toContain("dossier_members_confirmed");
    // Not a milestone of the Chủ thể's timeline (spec #49).
    expect((await w.t.app.dossiers.timeline(d.a, { dossierId: d.dossierId })).map((e) => e.action)).not.toContain("dossier.score_sheet.confirm_ready");

    // Story 94: the third thành viên still saves and confirms; the hồ sơ stays Sẵn sàng chốt.
    expect((await scoreAndConfirm(m(2), d.dossierId)).dossierState).toBe("member_confirmed");
  });

  it("shows the Chủ tịch and Thư ký progress without points, each thành viên only their own phiếu, and nobody else anything (stories 92, 95)", async () => {
    const d = await w.graded([m(0), m(1)]);
    await scoreAndConfirm(m(0), d.dossierId);
    await save(m(1), d.dossierId, 1, [{ code: "1.1", points: 20 }]);

    for (const who of [w.A.chair, w.A.secretary]) {
      const view = await w.t.app.scoring.readDossierScores(who, { dossierId: d.dossierId });
      expect(view).toEqual({
        kind: "progress_only",
        dossierId: d.dossierId,
        minGraders: 2,
        progress: [
          { userId: m(0).userId, fullName: m(0).fullName, state: "confirmed", confirmedAt: expect.any(Date), sheetId: expect.any(String) },
          { userId: m(1).userId, fullName: m(1).fullName, state: "draft", confirmedAt: null, sheetId: expect.any(String) },
        ].sort((x, y) => x.fullName.localeCompare(y.fullName, "vi")),
      });
      expect(JSON.stringify(view)).not.toMatch(/points|levelId/);
    }
    const mine = await own(m(1), d.dossierId);
    expect(mine.criteria.map((c) => c.points)).toEqual([20, null, null]);
    expect(JSON.stringify(mine)).not.toContain(m(0).userId);

    for (const who of [d.a, w.ward, w.province, await w.f.admin()]) {
      expect(await w.t.app.scoring.readDossierScores(who, { dossierId: d.dossierId })).toEqual({ kind: "none" });
    }
    await expect(w.t.app.scoring.readDossierScores(m(3), { dossierId: d.dossierId })).rejects.toMatchObject({ code: "not_found" });
    await expect(w.t.app.scoring.readDossierScores(w.B.secretary, { dossierId: d.dossierId })).rejects.toMatchObject({ code: "not_found" });
  });

  it("lists the S42 tiến độ chấm of the Hội đồng's hồ sơ for the Chủ tịch and Thư ký (story 97)", async () => {
    const d = await w.graded([m(0), m(1)]);
    await scoreAndConfirm(m(0), d.dossierId);

    const rows = await w.t.app.scoring.gradingProgress(w.A.chair);
    const row = rows.find((r) => r.dossierId === d.dossierId);
    expect(row).toMatchObject({ state: "member_review", confirmed: 1, graders: 2, minGraders: 2 });
    expect((await w.t.app.scoring.gradingProgress(w.B.chair)).map((r) => r.dossierId)).not.toContain(d.dossierId);
    await expect(w.t.app.scoring.gradingProgress(m(0))).rejects.toMatchObject({ code: "forbidden" });
  });

  it("audits the thành viên's read of the Chủ thể as a personal data access, as in step 3", async () => {
    const d = await w.graded([m(0), m(1)]);
    const dossier = await w.t.app.dossiers.get(m(0), { dossierId: d.dossierId });

    const entity = await w.t.app.entities.getEntity(m(0), { entityId: dossier.entityId });

    expect(entity.id).toBe(dossier.entityId);
    const rows = await w.t.app.audit.search(await w.f.admin(), { action: ["personal_data.viewed"], targetId: dossier.entityId });
    expect(rows.some((r) => r.actorUserId === m(0).userId)).toBe(true);
    await expect(w.t.app.entities.getEntity(m(3), { entityId: dossier.entityId })).rejects.toMatchObject({ code: "not_found" });
  });

  it("lets the thành viên read the newest Phiên bản nộp and its văn bản (story 80)", async () => {
    const d = await w.graded([m(0), m(1)]);
    const [latest] = (await w.t.app.dossiers.submissions(m(0), { dossierId: d.dossierId })).slice(-1);

    const doc = await w.t.app.dossiers.downloadSubmissionDocument(m(0), { dossierId: d.dossierId, submissionNumber: latest!.number, document: "self_assessment_report" });

    expect(doc.url).toMatch(/^http/);
    await expect(
      w.t.app.dossiers.downloadSubmissionDocument(m(3), { dossierId: d.dossierId, submissionNumber: latest!.number, document: "self_assessment_report" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
