import { describe, expect, it } from "vitest";
import { FIVE, FOUR, resultsWorld, THREE } from "./results-world";

/*
 * L16 CT-13 (#83, spec #79 stories 60, 62, 64, 65): what the Chủ thể sees of its kết quả. Before Công bố kết quả only the
 * state ("Đã chốt điểm, chờ quyết định" in the app), no điểm; from Công bố kết quả the điểm tổng hợp, điểm theo Phần, the
 * Hạng công nhận (or "đạt điểm, tỉnh đề nghị Trung ương đánh giá 5 sao") and the Nhận xét chung; never a phiếu, a thành
 * viên's name or the Báo cáo Tổ tư vấn.
 */
describe("L16 the Chủ thể's view of its kết quả (#83)", () => {
  const { w, closedMeeting, record, versionOf } = resultsWorld();

  const comment = async (dossierId: string, text: string) =>
    w.t.app.results.editGeneralComment(w.A.secretary, { dossierId, expectedVersion: await versionOf(dossierId), text });

  it("shows nothing but the state before Công bố kết quả (story 64)", async () => {
    const { dossiers } = await closedMeeting([FOUR]);
    const [four] = dossiers;
    await comment(four!.dossierId, "Cần hoàn thiện bao bì.");

    expect(await w.t.app.scoring.readDossierScores(four!.a, { dossierId: four!.dossierId })).toEqual({ kind: "none" });
    expect(await w.t.app.dossiers.get(four!.a, { dossierId: four!.dossierId })).toMatchObject({
      state: "score_finalized",
      generalComment: null,
      resultPublishedAt: null,
    });
  });

  it("shows the điểm tổng hợp, điểm theo Phần, Hạng công nhận and Nhận xét chung from Công bố kết quả, without any thành viên (stories 62, 65)", async () => {
    const { meetingId, dossiers } = await closedMeeting([FOUR, THREE]);
    const [four] = dossiers;
    await comment(four!.dossierId, "Cần hoàn thiện bao bì.");
    await record(meetingId);

    const view = await w.t.app.scoring.readDossierScores(four!.a, { dossierId: four!.dossierId });

    expect(view).toEqual({
      kind: "published_result",
      dossierId: four!.dossierId,
      dossierState: "recognized",
      publishedAt: w.t.clock.now(),
      total: 72.5,
      parts: [
        { code: "A", total: 30 },
        { code: "B", total: 25 },
        { code: "C", total: 17.5 },
      ],
      star: 4,
      outcome: "recognized",
      recognizedStar: 4,
      standing: "Công nhận 4 sao",
      generalComment: "Cần hoàn thiện bao bì.",
      letter: null,
    });
    const text = JSON.stringify(view);
    for (const m of [...w.A.members, ...w.A.advisors]) expect(text).not.toContain(m.fullName);
    expect(text).not.toMatch(/graders|lines|snapshot|advisory/i);
  });

  it("shows a hồ sơ 5 sao as đạt điểm, tỉnh đề nghị Trung ương đánh giá 5 sao (story 60)", async () => {
    const { meetingId, dossiers } = await closedMeeting([FIVE]);
    const [five] = dossiers;
    await record(meetingId);

    expect(await w.t.app.scoring.readDossierScores(five!.a, { dossierId: five!.dossierId })).toMatchObject({
      kind: "published_result",
      dossierState: "score_finalized",
      total: 100,
      star: 5,
      outcome: "five_star_proposal",
      recognizedStar: null,
      standing: "Đạt điểm, tỉnh đề nghị Trung ương đánh giá 5 sao",
    });
  });

  it("keeps the Cán bộ xã at none and the Cán bộ Sở at aggregate_only after Công bố kết quả", async () => {
    const { meetingId, dossiers } = await closedMeeting([THREE]);
    await record(meetingId);

    expect(await w.t.app.scoring.readDossierScores(w.ward, { dossierId: dossiers[0]!.dossierId })).toEqual({ kind: "none" });
    expect((await w.t.app.scoring.readDossierScores(w.province, { dossierId: dossiers[0]!.dossierId })).kind).toBe("aggregate_only");
  });
});
