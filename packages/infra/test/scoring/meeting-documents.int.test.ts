import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { DOCX_TYPE as DOCX, type UserActor } from "@ocop/core";
import { PRODUCT, entityIdOf } from "../dossiers/fixtures";
import { EICAR } from "../support";
import { scoringWorld } from "./world";

/*
 * L15 HD-09, TM-11 (#62, spec #49 stories 110 to 115): the Thư ký sinh the văn bản họp of a Phiên họp from
 * the mẫu tạm (bảng tổng hợp điểm, dự thảo biên bản, dự thảo quyết định công nhận), with the kết quả chốt
 * where there is one and the điểm tính tại chỗ otherwise, and uploads the biên bản đã ký số.
 * Bộ tiêu chí of the world: 1.1 (A, 0/20/40, Sao tối thiểu 3 needs 20), 2.1 (B, 0/25), 3.1 (C, 0/35).
 */
describe("L15 văn bản họp and biên bản đã ký (#62)", () => {
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

  /** A hồ sơ Sẵn sàng chốt: thành viên 0 and 1 confirmed these điểm, thành viên 2 left a nháp. */
  async function ready(first: [number, number, number], second: [number, number, number]) {
    const d = await w.graded([m(0), m(1), m(2)]);
    await scoreAndConfirm(m(0), d.dossierId, first);
    await scoreAndConfirm(m(1), d.dossierId, second);
    const entity = await w.t.app.entities.getEntity(d.a, { entityId: entityIdOf(d.a) });
    const { code } = await w.t.app.dossiers.get(w.A.secretary, { dossierId: d.dossierId });
    return { ...d, code, entityName: entity.name };
  }

  async function finalize(actor: UserActor, dossierId: string) {
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "full") throw new Error(view.kind);
    await w.t.app.scoring.finalize(actor, { dossierId, expectedVersion: view.dossierVersion });
  }

  /**
   * A Phiên họp with three hồ sơ: `done` chốt at 72,5 (4 sao, Lệch điểm lớn, thành viên 2 Vắng), `best` still
   * waiting at 100 (5 sao), `low` waiting at 10 (1 sao).
   */
  async function meeting() {
    const done = await ready([40, 25, 35], [20, 25, 0]);
    const best = await ready([40, 25, 35], [40, 25, 35]);
    const low = await ready([0, 0, 0], [20, 0, 0]);
    const { meetingId } = await w.t.app.scoring.createMeeting(w.A.secretary, {
      roundId: w.roundId,
      title: "Phiên họp thứ nhất",
      heldOn: "2026-10-25",
      location: "Phòng họp Sở",
      dossierIds: [done.dossierId, best.dossierId, low.dossierId],
    });
    await finalize(w.A.secretary, done.dossierId);
    return { meetingId, done, best, low };
  }

  const text = async (actor: UserActor, meetingId: string, kind: "score_table" | "minutes" | "decision") => {
    const { fileName, bytes } = await w.t.app.scoring.generateMeetingDocument(actor, { meetingId, kind });
    expect(fileName).toMatch(/\.docx$/);
    return docxText(bytes);
  };

  it("sinh the bảng tổng hợp điểm: Chủ thể, sản phẩm, Bộ tiêu chí, điểm từng thành viên, tổng hợp, Hạng sao, cờ (story 110)", async () => {
    const { meetingId, done, best } = await meeting();

    const doc = await text(w.A.secretary, meetingId, "score_table");

    expect(doc).toContain("BẢNG TỔNG HỢP ĐIỂM");
    expect(doc).toContain("cần đối chiếu");
    expect(doc).toContain("Phiên họp thứ nhất, ngày 25/10/2026, tại Phòng họp Sở");
    expect(doc).toContain(`${done.entityName} | ${PRODUCT.productName} | 1 - Rau củ quả |`);
    expect(doc).toContain(`${m(0).fullName}: 100`);
    expect(doc).toContain(`${m(1).fullName}: 45`);
    expect(doc).toContain(`${m(2).fullName}: Vắng`);
    expect(doc).toContain("| 72,5 | 4 sao | Lệch điểm lớn (55 điểm) | Đã chốt |");
    // Not chốt yet: tính tại chỗ, the nháp shows as such and the văn bản says it is a bản nháp.
    expect(doc).toContain(`${best.entityName} | ${PRODUCT.productName}`);
    expect(doc).toContain(`${m(2).fullName}: Chưa xác nhận`);
    expect(doc).toContain("| 100 | 5 sao |  | Tạm tính |");
    expect(doc).toContain("Bản nháp: còn 2 hồ sơ chưa chốt điểm");
  });

  it("sinh the dự thảo biên bản: điểm, hạng, người Vắng by hồ sơ and chỗ trống cho ý kiến (story 111)", async () => {
    const { meetingId, done, best } = await meeting();

    const doc = await text(w.A.chair, meetingId, "minutes");

    expect(doc).toContain("BIÊN BẢN HỌP HỘI ĐỒNG");
    expect(doc).toContain("cần đối chiếu");
    expect(doc).toContain(`Hồ sơ ${done.code}: ${PRODUCT.productName} của ${done.entityName} (Bộ tiêu chí 1 - Rau củ quả)`);
    expect(doc).toContain("Điểm tổng hợp: 72,5 điểm. Hạng sao: 4 sao. Tình trạng: Đã chốt.");
    expect(doc).toContain(`Thành viên vắng: ${m(2).fullName}\n`);
    expect(doc).toContain("Cờ chênh lệch: Lệch điểm lớn (55 điểm)");
    expect(doc).toContain(`Hồ sơ ${best.code}`);
    expect(doc).toContain(`Thành viên vắng: chưa chốt; chưa xác nhận phiếu: ${m(2).fullName}`);
    expect(doc).toContain("Nhận xét tổng hợp của Tổ tư vấn: Không có Báo cáo Tổ tư vấn");
    for (const blank of ["Thành phần tham dự: ....", "Ý kiến thảo luận: ....", "Kết luận của Hội đồng: ...."]) expect(doc).toContain(blank);
  });

  it("sinh the dự thảo quyết định with the hồ sơ from 3 sao only, and đề nghị xét 5 sao from 90 điểm (story 112)", async () => {
    const { meetingId, done, best, low } = await meeting();

    const doc = await text(w.A.secretary, meetingId, "decision");

    expect(doc).toContain("QUYẾT ĐỊNH");
    expect(doc).toContain("Công nhận 2 sản phẩm đạt chuẩn OCOP");
    expect(doc).toContain(`| ${PRODUCT.productName} | ${done.entityName} | Ấp 1 | 1 - Rau củ quả | 72,5 | 4 sao |  |`);
    expect(doc).toContain(`| ${PRODUCT.productName} | ${best.entityName} | Ấp 1 | 1 - Rau củ quả | 100 | 5 sao | Đề nghị xét 5 sao |`);
    expect(doc).not.toContain(low.entityName);
  });

  it("sinh lại after chốt gives the số liệu cuối, and records who sinh what (story 113)", async () => {
    const { meetingId, best } = await meeting();
    expect(await text(w.A.secretary, meetingId, "score_table")).toContain("| 100 | 5 sao |  | Tạm tính |");

    // Thành viên 1 is Trả phiếu and confirms 40/25/0 instead: the hồ sơ chốt at 82,5.
    const scores = await w.t.app.scoring.readDossierScores(w.A.secretary, { dossierId: best.dossierId });
    if (scores.kind !== "full") throw new Error(scores.kind);
    const sheetId = scores.graders.find((g) => g.userId === m(1).userId)!.sheetId!;
    await w.t.app.scoring.returnScoreSheet(w.A.secretary, { dossierId: best.dossierId, sheetId, reason: "Xem lại phần C" });
    await scoreAndConfirm(m(1), best.dossierId, [40, 25, 0]);
    await finalize(w.A.secretary, best.dossierId);

    const doc = await text(w.A.secretary, meetingId, "score_table");
    expect(doc).toContain("| 82,5 | 4 sao | Lệch điểm lớn (35 điểm) | Đã chốt |");
    expect(doc).toContain("Bản nháp: còn 1 hồ sơ chưa chốt điểm");
    const audited = await w.t.app.audit.search(await w.f.admin(), { action: ["scoring.meeting.document_generated"], targetId: meetingId });
    expect(audited).toHaveLength(2);
    expect(audited[0]).toMatchObject({ actorUserId: w.A.secretary.userId, metadata: { kind: "score_table", pending: 1 } });
  });

  describe("biên bản đã ký (story 115)", () => {
    it("keeps each biên bản đã ký số the Thư ký uploads, numbered 1, 2, …, with audit and event, before chốt is required", async () => {
      const { meetingId } = await w.t.app.scoring.createMeeting(w.A.secretary, { roundId: w.roundId, title: "Phiên họp ký", heldOn: "2026-10-25", location: "Sở", dossierIds: [] });
      const first = await w.f.uploadPdf(w.A.secretary, "meeting_minutes", "Biên bản đã ký.pdf");
      const second = await w.f.uploadPdf(w.A.secretary, "meeting_minutes", "Biên bản đã ký lần 2.pdf");

      expect(await w.t.app.scoring.attachMeetingMinutes(w.A.secretary, { meetingId, fileId: first })).toEqual({ number: 1 });
      expect(await w.t.app.scoring.attachMeetingMinutes(w.A.secretary, { meetingId, fileId: second })).toEqual({ number: 2 });

      const { minutes } = await w.t.app.scoring.getMeeting(w.A.chair, { meetingId });
      expect(minutes).toEqual([
        expect.objectContaining({ number: 2, fileName: "Biên bản đã ký lần 2.pdf", status: "clean", uploadedBy: { userId: w.A.secretary.userId, fullName: w.A.secretary.fullName } }),
        expect.objectContaining({ number: 1, fileName: "Biên bản đã ký.pdf" }),
      ]);
      const link = await w.t.app.scoring.downloadMeetingMinutes(w.A.chair, { meetingId, number: 1 });
      expect(link.fileName).toBe("Biên bản đã ký.pdf");
      expect((await fetch(link.url)).ok).toBe(true);
      const [audited] = await w.t.app.audit.search(await w.f.admin(), { action: ["scoring.meeting.minutes_attached"], targetId: meetingId });
      expect(audited).toMatchObject({ actorUserId: w.A.secretary.userId, metadata: { number: 2, fileId: second } });
      await w.t.drainJobs();
    });

    it("takes only the Thư ký's own PDF upload of purpose meeting_minutes that is not blocked", async () => {
      const { meetingId } = await w.t.app.scoring.createMeeting(w.A.secretary, { roundId: w.roundId, title: "Phiên họp ký 2", heldOn: "2026-10-25", location: "Sở", dossierIds: [] });
      await expect(w.t.app.files.requestUpload(w.A.chair, { purpose: "meeting_minutes", fileName: "a.pdf", contentType: "application/pdf", size: 10 })).rejects.toMatchObject({ code: "forbidden" });
      await expect(w.t.app.files.requestUpload(w.A.secretary, { purpose: "meeting_minutes", fileName: "a.docx", contentType: DOCX, size: 10 })).rejects.toMatchObject({ code: "file_type_not_allowed" });
      const evidence = await w.f.uploadPdf(m(0), "grading_evidence", "Bằng chứng.pdf");
      await expect(w.t.app.scoring.attachMeetingMinutes(w.A.secretary, { meetingId, fileId: evidence })).rejects.toMatchObject({ code: "not_found" });
      const blocked = await w.f.uploadPdf(w.A.secretary, "meeting_minutes", "Có mã độc.pdf", { content: Buffer.from(EICAR) });
      const scanning = await w.f.uploadPdf(w.A.secretary, "meeting_minutes", "Đang quét.pdf", { scan: false });
      await expect(w.t.app.scoring.attachMeetingMinutes(w.A.secretary, { meetingId, fileId: blocked })).rejects.toMatchObject({ code: "file_blocked" });
      expect(await w.t.app.scoring.attachMeetingMinutes(w.A.secretary, { meetingId, fileId: scanning })).toEqual({ number: 1 });
      await expect(w.t.app.scoring.downloadMeetingMinutes(w.A.secretary, { meetingId, number: 1 })).rejects.toMatchObject({ code: "file_not_ready" });
      // One file is one biên bản: attaching it twice is refused.
      await w.t.drainJobs();
      await expect(w.t.app.scoring.attachMeetingMinutes(w.A.secretary, { meetingId, fileId: scanning })).rejects.toMatchObject({ code: "already_attached" });
    });

    it("never changes a biên bản once attached: the DB refuses UPDATE and DELETE", async () => {
      const { meetingId } = await w.t.app.scoring.createMeeting(w.A.secretary, { roundId: w.roundId, title: "Phiên họp ký 3", heldOn: "2026-10-25", location: "Sở", dossierIds: [] });
      await w.t.app.scoring.attachMeetingMinutes(w.A.secretary, { meetingId, fileId: await w.f.uploadPdf(w.A.secretary, "meeting_minutes") });

      await expect(w.db.app.query("UPDATE scoring.meeting_minutes SET number = 5 WHERE meeting_id = $1", [meetingId])).rejects.toThrow(/permission denied/);
      await expect(w.db.app.query("DELETE FROM scoring.meeting_minutes WHERE meeting_id = $1", [meetingId])).rejects.toThrow(/permission denied/);
      await expect(w.db.admin.query("UPDATE scoring.meeting_minutes SET number = 5 WHERE meeting_id = $1", [meetingId])).rejects.toThrow(/immutable/);
      await expect(w.db.admin.query("DELETE FROM scoring.meeting_minutes WHERE meeting_id = $1", [meetingId])).rejects.toThrow(/immutable/);
    });
  });

  it("gives a Phiên họp of another Hội đồng as not found", async () => {
    const { meetingId } = await meeting();
    await expect(w.t.app.scoring.generateMeetingDocument(w.B.secretary, { meetingId, kind: "minutes" })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("L15 văn bản họp in a đợt dựa trên Tổ tư vấn (#62, story 114)", () => {
  const w = scoringWorld({ gradingMode: "advisory_based", minGraders: 1 });

  it("takes the nhận xét tổng hợp from the Báo cáo Tổ tư vấn the kết quả chốt rests on", async () => {
    const [m0] = w.A.members;
    const advisor = w.A.advisors[0]!;
    const d = await w.f.advisoryCopied(w.ward, w.province, w.setId, w.A.secretary, { members: [m0!], advisors: [advisor] });
    const own = await w.t.app.scoring.readDossierScores(m0!, { dossierId: d.dossierId });
    if (own.kind !== "own_sheet") throw new Error(own.kind);
    await w.t.app.scoring.confirmScoreSheet(m0!, { dossierId: d.dossierId, expectedVersion: own.sheet!.version });
    const { meetingId } = await w.t.app.scoring.createMeeting(w.A.secretary, { roundId: w.roundId, title: "Phiên họp", heldOn: "2026-10-25", location: "Sở", dossierIds: [d.dossierId] });

    const { bytes } = await w.t.app.scoring.generateMeetingDocument(w.A.secretary, { meetingId, kind: "minutes" });

    const summary = (await w.t.app.scoring.advisoryReportVersions(w.A.secretary, { dossierId: d.dossierId }))[0]!.report.summary;
    expect(docxText(bytes)).toContain(`Nhận xét tổng hợp của Tổ tư vấn: ${summary} (Báo cáo Tổ tư vấn phiên bản 1)`);
  });
});

function docxText(bytes: Uint8Array) {
  const xml = new PizZip(bytes).file("word/document.xml")!.asText();
  return xml
    .replace(/<\/w:p>\s*<\/w:tc>/g, " | ")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&");
}
