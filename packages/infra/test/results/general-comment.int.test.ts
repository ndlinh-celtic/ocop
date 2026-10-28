import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { scoringWorld } from "../scoring/world";

/*
 * L16 CT-13, HD-10 (#80, spec #79 stories 1 to 8, 37, 68, 69): the Chủ tịch or Thư ký writes the Nhận xét chung of a hồ sơ
 * Đã chốt điểm until Công bố kết quả; it prints in the dự thảo biên bản and dự thảo quyết định. From chốt the Cán bộ Sở
 * sees the điểm tổng hợp, điểm theo Phần, Hạng sao and Tiêu chí dưới mức, never a thành viên's phiếu.
 * Bộ tiêu chí of the world: 1.1 (A, 0/20/40, Sao tối thiểu 3 needs 20), 2.1 (B, 0/25), 3.1 (C, 0/35).
 */
describe("L16 Nhận xét chung and the Sở's view of the kết quả chốt (#80)", () => {
  const w = scoringWorld({ minGraders: 2 });
  const m = (i: number) => w.A.members[i]!;

  async function scoreAndConfirm(actor: UserActor, dossierId: string, [a, b, c]: [number, number, number]) {
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "own_sheet") throw new Error(`expected own_sheet, got ${view.kind}`);
    const lines = (
      [
        ["1.1", a],
        ["2.1", b],
        ["3.1", c],
      ] as const
    ).map(([code, points]) => ({ criterionId: w.criterionId(code), levelId: w.level(`${code}:${points}`), comment: "", evidenceFileIds: [] }));
    const { version } = await w.t.app.scoring.saveScoreSheet(actor, { dossierId, expectedVersion: view.sheet!.version, lines });
    await w.t.app.scoring.confirmScoreSheet(actor, { dossierId, expectedVersion: version });
  }

  /** A hồ sơ Sẵn sàng chốt in a Phiên họp, both thành viên chấm giving these điểm. */
  async function ready(points: [number, number, number] = [20, 0, 35]) {
    const d = await w.graded([m(0), m(1)]);
    await scoreAndConfirm(m(0), d.dossierId, points);
    await scoreAndConfirm(m(1), d.dossierId, points);
    const { meetingId } = await w.t.app.scoring.createMeeting(w.A.secretary, {
      roundId: w.roundId,
      title: "Phiên họp thứ nhất",
      heldOn: "2026-10-25",
      location: "Phòng họp Sở",
      dossierIds: [d.dossierId],
    });
    return { ...d, meetingId };
  }

  const versionOf = async (dossierId: string) => (await w.t.app.dossiers.get(w.A.secretary, { dossierId })).version;

  /** A hồ sơ Đã chốt điểm, by default at 55 điểm (3 sao) with 2.1 at 0. */
  async function finalized(points?: [number, number, number]) {
    const d = await ready(points);
    await w.t.app.scoring.finalize(w.A.secretary, { dossierId: d.dossierId, expectedVersion: await versionOf(d.dossierId) });
    return d;
  }

  const edit = async (actor: UserActor, dossierId: string, text: string) =>
    w.t.app.results.editGeneralComment(actor, { dossierId, expectedVersion: await versionOf(dossierId), text });

  /** What #83 does when Công bố kết quả: sets result_published_at once, as transition() writes a hồ sơ (version + 1). */
  const publish = (dossierId: string) =>
    w.db.admin.query("UPDATE dossier.dossier SET result_published_at = now(), version = version + 1 WHERE id = $1", [dossierId]);

  it("lets the Thư ký write it and the Chủ tịch change it on a hồ sơ Đã chốt điểm, auditing the text before and after (stories 1, 2, 7)", async () => {
    const d = await finalized();
    const at = new Date(w.t.clock.now());

    const first = await edit(w.A.secretary, d.dossierId, "Sản phẩm có tiềm năng, cần hoàn thiện bao bì.");
    w.t.clock.advance(1000);
    const second = await edit(w.A.chair, d.dossierId, "Sản phẩm có tiềm năng; cần hoàn thiện bao bì và truy xuất nguồn gốc.");

    expect(second.version).toBeGreaterThan(first.version);
    const read = await w.t.app.dossiers.get(w.province, { dossierId: d.dossierId });
    expect(read).toMatchObject({
      state: "score_finalized",
      generalComment: "Sản phẩm có tiềm năng; cần hoàn thiện bao bì và truy xuất nguồn gốc.",
      generalCommentUpdatedBy: w.A.chair.userId,
      version: second.version,
    });
    const admin = await w.f.admin();
    const entries = await w.t.app.audit.search(admin, { action: ["dossier.general_comment.edit"], from: at, to: new Date(at.getTime() + 3_600_000) });
    const ours = entries.filter((e) => e.targetId === d.dossierId);
    expect(ours.map((e) => [e.actorUserId, e.metadata])).toEqual(
      expect.arrayContaining([
        [w.A.secretary.userId, expect.objectContaining({ before: null, after: "Sản phẩm có tiềm năng, cần hoàn thiện bao bì." })],
        [
          w.A.chair.userId,
          expect.objectContaining({
            before: "Sản phẩm có tiềm năng, cần hoàn thiện bao bì.",
            after: "Sản phẩm có tiềm năng; cần hoàn thiện bao bì và truy xuất nguồn gốc.",
          }),
        ],
      ]),
    );
    const outbox = await w.db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.general_comment_edited' AND payload->>'dossierId' = $1", [
      d.dossierId,
    ]);
    expect(outbox.rowCount).toBe(2);
    // Off the Chủ thể's timeline.
    expect((await w.t.app.dossiers.timeline(d.a, { dossierId: d.dossierId })).some((e) => e.action === "dossier.general_comment.edit")).toBe(false);
  });

  it("refuses it before chốt điểm (story 4)", async () => {
    const d = await ready();

    await expect(edit(w.A.secretary, d.dossierId, "Sớm quá")).rejects.toMatchObject({ code: "invalid_state" });
  });

  it("refuses more than 4.000 ký tự, and takes exactly 4.000", async () => {
    const d = await finalized();

    await expect(edit(w.A.secretary, d.dossierId, "a".repeat(4001))).rejects.toMatchObject({ code: "general_comment_too_long" });
    await edit(w.A.secretary, d.dossierId, "a".repeat(4000));
    expect((await w.t.app.dossiers.get(w.A.secretary, { dossierId: d.dossierId })).generalComment).toHaveLength(4000);
  });

  it("refuses it once the kết quả is Công bố, and the DB refuses a change too (story 3)", async () => {
    const d = await finalized();
    await edit(w.A.secretary, d.dossierId, "Trước công bố");
    await publish(d.dossierId);

    await expect(edit(w.A.secretary, d.dossierId, "Sau công bố")).rejects.toMatchObject({ code: "result_published" });
    await expect(w.db.app.query("UPDATE dossier.dossier SET general_comment = 'x', version = version + 1 WHERE id = $1", [d.dossierId])).rejects.toThrow(
      /Nhận xét chung|published/,
    );
    await expect(w.db.app.query("UPDATE dossier.dossier SET result_published_at = NULL, version = version + 1 WHERE id = $1", [d.dossierId])).rejects.toThrow(
      /published/,
    );
    expect((await w.t.app.dossiers.get(w.A.secretary, { dossierId: d.dossierId })).generalComment).toBe("Trước công bố");
  });

  it("does not show it to the Chủ thể or the Cán bộ xã before Công bố kết quả", async () => {
    const d = await finalized();
    await edit(w.A.secretary, d.dossierId, "Nhận xét nội bộ");

    expect((await w.t.app.dossiers.get(d.a, { dossierId: d.dossierId })).generalComment).toBeNull();
    expect((await w.t.app.dossiers.get(w.ward, { dossierId: d.dossierId })).generalComment).toBeNull();
    expect(JSON.stringify(await w.t.app.dossiers.list(d.a, {}))).not.toContain("Nhận xét nội bộ");
  });

  it("prints it in the dự thảo biên bản and dự thảo quyết định when sinh lại (story 8)", async () => {
    const d = await finalized();
    await edit(w.A.secretary, d.dossierId, "Hội đồng đánh giá sản phẩm đạt yêu cầu.");

    for (const kind of ["minutes", "decision"] as const) {
      const { bytes } = await w.t.app.scoring.generateMeetingDocument(w.A.secretary, { meetingId: d.meetingId, kind });
      expect(docxText(bytes)).toContain("Hội đồng đánh giá sản phẩm đạt yêu cầu.");
    }
  });

  it("shows the Cán bộ Sở the tổng hợp, Phần, Hạng sao and Tiêu chí dưới mức from chốt, without any phiếu (stories 37, 68)", async () => {
    const before = await ready([0, 25, 35]);
    expect(await w.t.app.scoring.readDossierScores(w.province, { dossierId: before.dossierId })).toEqual({ kind: "none" });
    await w.t.app.scoring.finalize(w.A.secretary, { dossierId: before.dossierId, expectedVersion: await versionOf(before.dossierId) });

    const view = await w.t.app.scoring.readDossierScores(w.province, { dossierId: before.dossierId });

    if (view.kind !== "aggregate_only") throw new Error(`expected aggregate_only, got ${view.kind}`);
    expect(view.aggregate).toMatchObject({ total: 60, star: 2 });
    expect(view.aggregate.parts.map((p) => [p.code, p.total])).toEqual([
      ["A", 0],
      ["B", 25],
      ["C", 35],
    ]);
    expect(view.underperforming).toEqual([
      { criterionId: w.criterionId("1.1"), code: "1.1", name: expect.any(String), average: 0, maxPoints: 40, reasons: ["min_star", "low_ratio"] },
    ]);
    const text = JSON.stringify(view);
    for (const x of [m(0), m(1)]) {
      expect(text).not.toContain(x.fullName);
      expect(text).not.toContain(x.userId);
    }
    expect(text).not.toContain("graders");
    expect(await w.t.app.scoring.readDossierScores(w.ward, { dossierId: before.dossierId })).toEqual({ kind: "none" });
    expect(await w.t.app.scoring.readDossierScores(before.a, { dossierId: before.dossierId })).toEqual({ kind: "none" });
  });

  it("lists Tiêu chí dưới mức by the ratio Quản trị sets in results.underperforming_ratio (default 0,5)", async () => {
    const d = await finalized(); // 1.1 at 20 of 40, 2.1 at 0 of 25, 3.1 at 35 of 35
    const admin = await w.f.admin();
    const codes = async () => {
      const view = await w.t.app.scoring.readDossierScores(w.province, { dossierId: d.dossierId });
      if (view.kind !== "aggregate_only") throw new Error(view.kind);
      return view.underperforming?.map((c) => c.code);
    };
    expect(await w.t.app.system.underperformingRatio(admin)).toEqual({ ratio: 0.5 });
    expect(await codes()).toEqual(["2.1"]);

    await w.t.app.system.setUnderperformingRatio(admin, { ratio: 0.6 });
    try {
      expect(await w.t.app.system.underperformingRatio(admin)).toEqual({ ratio: 0.6 });
      expect(await codes()).toEqual(["1.1", "2.1"]);
      const [entry] = await w.t.app.audit.search(admin, { action: ["system.underperforming_ratio_changed"] });
      expect(entry).toMatchObject({ actorUserId: admin.userId, before: { ratio: 0.5 }, after: { ratio: 0.6 } });
    } finally {
      await w.t.app.system.setUnderperformingRatio(admin, { ratio: 0.5 });
    }
  });

  it.each([[0], [1.5], [-0.1], ["0.5"], [Number.NaN]])("refuses the ratio %j", async (ratio) => {
    const admin = await w.f.admin();
    await expect(w.t.app.system.setUnderperformingRatio(admin, { ratio })).rejects.toMatchObject({ code: "invalid_underperforming_ratio" });
  });

  it("leaves the ratio to Quản trị", async () => {
    await expect(w.t.app.system.setUnderperformingRatio(w.province, { ratio: 0.4 })).rejects.toMatchObject({ code: "forbidden" });
  });
});

function docxText(bytes: Uint8Array): string {
  const xml = new PizZip(bytes).file("word/document.xml")!.asText();
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&");
}
