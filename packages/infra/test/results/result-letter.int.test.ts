import { randomUUID } from "node:crypto";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { resultsWorld, THREE, TWO } from "./results-world";

/*
 * L16 HD-10, CT-13 Thư kết quả không đạt (#85, spec #79 stories 36 to 45, 66). The Cán bộ Sở issues the letter of a hồ sơ
 * dưới 3 sao Đã chốt điểm: a PDF kept as issued, the hồ sơ Không đạt and its kết quả Công bố, the Chủ thể told. A later
 * fix is a thư đính chính, the next phiên bản with its lý do; the Chủ thể sees only the newest.
 */
describe("L16 Thư kết quả không đạt (#85)", () => {
  const { w, closedMeeting, versionOf } = resultsWorld();

  async function twoStar() {
    const { dossiers } = await closedMeeting([TWO]);
    return dossiers[0]!;
  }

  const issue = async (dossierId: string, more: { advice?: string; reason?: string; criterionIds?: string[] } = {}) =>
    w.t.app.results.issueResultLetter(w.province, {
      dossierId,
      expectedVersion: await versionOf(dossierId),
      criterionIds: more.criterionIds ?? [w.criterionId("3.1")],
      advice: more.advice ?? "Bổ sung hồ sơ chứng nhận chất lượng.",
      reason: more.reason,
    });

  it("issues the letter of a hồ sơ dưới 3 sao: Không đạt, Công bố kết quả, the Chủ thể sees it (story 40)", async () => {
    const d = await twoStar();

    const issued = await w.t.app.results.issueResultLetter(w.province, {
      dossierId: d.dossierId,
      expectedVersion: await versionOf(d.dossierId),
      criterionIds: [w.criterionId("3.1")],
      advice: "Bổ sung hồ sơ chứng nhận chất lượng.",
    });

    expect(issued).toMatchObject({ n: 1 });
    expect(await w.t.app.dossiers.get(w.province, { dossierId: d.dossierId })).toMatchObject({ state: "not_passed", resultPublishedAt: w.t.clock.now() });
    const view = await w.t.app.scoring.readDossierScores(d.a, { dossierId: d.dossierId });
    expect(view).toMatchObject({
      kind: "published_result",
      dossierState: "not_passed",
      total: 45,
      star: 2,
      outcome: "not_passed",
      standing: "Không đạt",
      letter: {
        n: 1,
        issuedAt: w.t.clock.now(),
        criteria: [{ code: "3.1", name: "Tiêu chí 3.1", average: 0, maxPoints: 35 }],
        advice: "Bổ sung hồ sơ chứng nhận chất lượng.",
        reason: null,
      },
    });
  });

  it("prefills the điểm, Phần, Hạng sao, Nhận xét chung and the computed Tiêu chí dưới mức, with every Tiêu chí of the Bộ to add (stories 36 to 38)", async () => {
    const d = await twoStar();
    await w.t.app.results.editGeneralComment(w.A.secretary, {
      dossierId: d.dossierId,
      expectedVersion: await versionOf(d.dossierId),
      text: "Cần chứng nhận chất lượng.",
    });

    const draft = await w.t.app.results.resultLetterDraft(w.province, { dossierId: d.dossierId });

    expect(draft).toMatchObject({
      dossierId: d.dossierId,
      dossierVersion: await versionOf(d.dossierId),
      dossierState: "score_finalized",
      total: 45,
      parts: [
        { code: "A", total: 20 },
        { code: "B", total: 25 },
        { code: "C", total: 0 },
      ],
      star: 2,
      generalComment: "Cần chứng nhận chất lượng.",
      letters: [],
    });
    expect(draft.suggested.map((c) => [c.code, c.reasons])).toEqual([["3.1", ["low_ratio"]]]);
    expect(draft.criteria.map((c) => c.code)).toEqual(["1.1", "2.1", "3.1"]);
  });

  it("refuses a letter for a hồ sơ from 3 sao (story 41)", async () => {
    const { dossiers } = await closedMeeting([THREE]);
    const dossierId = dossiers[0]!.dossierId;

    await expect(w.t.app.results.resultLetterDraft(w.province, { dossierId })).rejects.toMatchObject({ code: "result_letter_not_below_three" });
    await expect(
      w.t.app.results.issueResultLetter(w.province, { dossierId, expectedVersion: await versionOf(dossierId), criterionIds: [], advice: "" }),
    ).rejects.toMatchObject({ code: "result_letter_not_below_three" });
    expect((await w.t.app.dossiers.get(w.province, { dossierId })).state).toBe("score_finalized");
  });

  it("lists only Tiêu chí of the hồ sơ's own Bộ tiêu chí, the Sở may drop computed ones and add others (story 38)", async () => {
    const d = await twoStar();
    const input = { dossierId: d.dossierId, expectedVersion: await versionOf(d.dossierId), advice: "" };

    await expect(w.t.app.results.issueResultLetter(w.province, { ...input, criterionIds: [w.level("1.1:20")] })).rejects.toMatchObject({
      code: "criterion_not_in_set",
    });
    await expect(w.t.app.results.issueResultLetter(w.province, { ...input, criterionIds: [randomUUID()] })).rejects.toMatchObject({
      code: "criterion_not_in_set",
    });

    await w.t.app.results.issueResultLetter(w.province, { ...input, criterionIds: [w.criterionId("1.1")] });
    const view = await w.t.app.scoring.readDossierScores(d.a, { dossierId: d.dossierId });
    expect(view).toMatchObject({ letter: { criteria: [{ code: "1.1", average: 20, maxPoints: 40 }] } });
  });

  it("previews the letter as DOCX, prefilled and with the hướng dẫn nộp lại, storing nothing (stories 36, 42)", async () => {
    const d = await twoStar();
    const files = async () => (await w.db.admin.query("SELECT count(*)::int AS n FROM platform.file WHERE purpose = 'generated_document'")).rows[0].n;
    const before = await files();

    const { fileName, bytes } = await w.t.app.results.previewResultLetter(w.province, {
      dossierId: d.dossierId,
      expectedVersion: await versionOf(d.dossierId),
      criterionIds: [w.criterionId("3.1")],
      advice: "Bổ sung hồ sơ chứng nhận chất lượng.",
    });

    expect(fileName).toMatch(/\.docx$/);
    const text = docxText(bytes);
    expect(text).toContain("45 điểm");
    expect(text).toContain("2 sao (không đạt)");
    expect(text).toContain("3.1 Tiêu chí 3.1");
    expect(text).toContain("Điểm trung bình dưới tỷ lệ");
    expect(text).toContain("Bổ sung hồ sơ chứng nhận chất lượng.");
    expect(text).toContain("nộp lại hồ sơ ở đợt đánh giá sau");
    expect(await files()).toBe(before);
    expect((await w.t.app.dossiers.get(w.province, { dossierId: d.dossierId })).state).toBe("score_finalized");
  });

  it("stores the PDF converted from the filled mẫu mặc định, with the letter as issued (stories 40, 78)", async () => {
    const d = await twoStar();
    const conversions = w.t.pdf.count;

    const issued = await issue(d.dossierId);

    expect(w.t.pdf.count).toBe(conversions + 1);
    expect(docxText(w.t.pdf.calls.at(-1)!)).toContain("nộp lại hồ sơ ở đợt đánh giá sau");
    const file = await w.db.admin.query("SELECT purpose, status, declared_type, owner_user_id FROM platform.file WHERE id = $1", [issued.fileId]);
    expect(file.rows).toEqual([{ purpose: "generated_document", status: "clean", declared_type: "application/pdf", owner_user_id: w.province.userId }]);
    const letter = await w.db.admin.query(
      "SELECT n, criteria, advice, reason, file_id, template_version_id, issued_by FROM results.result_letter WHERE id = $1",
      [issued.letterId],
    );
    expect(letter.rows).toEqual([
      {
        n: 1,
        criteria: [{ criterionId: w.criterionId("3.1"), code: "3.1", name: "Tiêu chí 3.1", average: 0, maxPoints: 35, reasons: ["low_ratio"] }],
        advice: "Bổ sung hồ sơ chứng nhận chất lượng.",
        reason: null,
        file_id: issued.fileId,
        template_version_id: null,
        issued_by: w.province.userId,
      },
    ]);
  });

  it("issues a thư đính chính with its lý do; the Chủ thể sees and downloads only the newest, Công bố stays as first set (stories 43, 44, 66)", async () => {
    const d = await twoStar();
    const first = await issue(d.dossierId);
    const publishedAt = w.t.clock.now();
    w.t.clock.advance(60_000);

    await expect(issue(d.dossierId, { advice: "Sửa lời khuyên." })).rejects.toMatchObject({ code: "reason_required" });
    const second = await issue(d.dossierId, { advice: "Sửa lời khuyên.", reason: "Lời khuyên cũ ghi nhầm" });

    expect(second).toMatchObject({ n: 2 });
    expect(docxText(w.t.pdf.calls.at(-1)!)).toContain("Thư này đính chính Thư kết quả số 1. Lý do: Lời khuyên cũ ghi nhầm");
    expect(await w.t.app.dossiers.get(w.province, { dossierId: d.dossierId })).toMatchObject({ state: "not_passed", resultPublishedAt: publishedAt });
    expect(await w.t.app.scoring.readDossierScores(d.a, { dossierId: d.dossierId })).toMatchObject({
      publishedAt,
      letter: { id: second.letterId, n: 2, advice: "Sửa lời khuyên.", reason: "Lời khuyên cũ ghi nhầm" },
    });
    const draft = await w.t.app.results.resultLetterDraft(w.province, { dossierId: d.dossierId });
    expect(draft.letters.map((l) => l.n)).toEqual([1, 2]);

    const keyOf = async (fileId: string) => (await w.db.admin.query("SELECT storage_key FROM platform.file WHERE id = $1", [fileId])).rows[0].storage_key;
    const link = await w.t.app.results.downloadResultLetter(d.a, { dossierId: d.dossierId });
    expect(link.url).toContain(await keyOf(second.fileId));
    await expect(w.t.app.results.downloadResultLetter(d.a, { dossierId: d.dossierId, letterId: first.letterId })).rejects.toMatchObject({ code: "not_found" });
    const old = await w.t.app.results.downloadResultLetter(w.province, { dossierId: d.dossierId, letterId: first.letterId });
    expect(old.url).toContain(await keyOf(first.fileId));
  });

  it("keeps each letter as issued: the DB refuses UPDATE, DELETE and TRUNCATE on result_letter (story 43)", async () => {
    const d = await twoStar();
    const { letterId } = await issue(d.dossierId);

    for (const sql of ["UPDATE results.result_letter SET advice = 'khác' WHERE id = $1", "DELETE FROM results.result_letter WHERE id = $1"]) {
      await expect(w.db.app.query(sql, [letterId])).rejects.toThrow();
      await expect(w.db.admin.query(sql, [letterId])).rejects.toThrow(/never changes/);
    }
    await expect(w.db.admin.query("TRUNCATE results.result_letter CASCADE")).rejects.toThrow(/never changes/);
    expect((await w.db.admin.query("SELECT advice FROM results.result_letter WHERE id = $1", [letterId])).rows).toEqual([
      { advice: "Bổ sung hồ sơ chứng nhận chất lượng." },
    ]);
  });

  it("tells the Chủ thể in the app and by email of the letter and of each thư đính chính, once each, link only (stories 40, 44)", async () => {
    const d = await twoStar();
    await issue(d.dossierId);
    await w.t.drainJobs();
    await issue(d.dossierId, { reason: "Bổ sung tiêu chí" });
    await w.t.drainJobs();

    const inbox = (await w.t.app.notifications.list(d.a)).filter((n) => n.link === `/chu-the/ho-so/${d.dossierId}` && n.kind.startsWith("result_letter"));
    expect(inbox.map((n) => n.kind).sort()).toEqual(["result_letter_corrected", "result_letter_issued"]);
    expect((await w.t.app.notifications.list(d.a)).some((n) => n.kind === "dossier_result_published" && n.link === `/chu-the/ho-so/${d.dossierId}`)).toBe(
      false,
    );
    const mail = w.t.mailbox.to(d.a.email).filter((e) => e.text.includes(`/chu-the/ho-so/${d.dossierId}`) && e.subject.includes("kết quả"));
    expect(mail.map((e) => e.subject).sort()).toEqual(["Hồ sơ OCOP có Thư kết quả đánh giá", "Hồ sơ OCOP có Thư kết quả đính chính"]);
    for (const e of mail) expect(e.text.replaceAll(`/chu-the/ho-so/${d.dossierId}`, "")).not.toMatch(/45|Tiêu chí 3\.1/);
  });

  it("writes the timeline, audit and outbox with the letter; a failed PDF conversion leaves nothing (story 40)", async () => {
    const d = await twoStar();
    w.t.pdf.failNext(1);
    await expect(issue(d.dossierId)).rejects.toMatchObject({ code: "pdf_conversion_failed" });
    expect((await w.t.app.dossiers.get(w.province, { dossierId: d.dossierId })).state).toBe("score_finalized");
    expect((await w.db.admin.query("SELECT 1 FROM results.result_letter WHERE dossier_id = $1", [d.dossierId])).rows).toHaveLength(0);

    const { letterId } = await issue(d.dossierId);

    const audit = await w.db.admin.query("SELECT action FROM platform.audit_log WHERE target_id IN ($1, $2) ORDER BY action", [d.dossierId, letterId]);
    expect(audit.rows.map((r) => r.action)).toEqual(expect.arrayContaining(["dossier.result_letter.issue", "results.result_letter.issued"]));
    const outbox = await w.db.admin.query("SELECT type, payload FROM platform.outbox WHERE payload->>'dossierId' = $1 ORDER BY occurred_at, type", [
      d.dossierId,
    ]);
    expect(outbox.rows).toEqual(
      expect.arrayContaining([
        { type: "dossier.result_published", payload: expect.objectContaining({ to: "not_passed", outcome: "not_passed" }) },
        { type: "result_letter.issued", payload: expect.objectContaining({ letterId, n: 1 }) },
      ]),
    );
    const timeline = await w.t.app.dossiers.timeline(d.a, { dossierId: d.dossierId });
    expect(timeline.some((e) => e.action === "dossier.result_letter.issue")).toBe(true);
  });

  it("refuses a stale version and a letter after a newer one (story 40)", async () => {
    const d = await twoStar();
    const stale = await versionOf(d.dossierId);
    await w.t.app.results.editGeneralComment(w.A.secretary, { dossierId: d.dossierId, expectedVersion: stale, text: "Mới" });

    await expect(
      w.t.app.results.issueResultLetter(w.province, { dossierId: d.dossierId, expectedVersion: stale, criterionIds: [], advice: "" }),
    ).rejects.toMatchObject({ code: "version_conflict" });
  });
});

function docxText(bytes: Uint8Array): string {
  const xml = new PizZip(bytes).file("word/document.xml")!.asText();
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&");
}
