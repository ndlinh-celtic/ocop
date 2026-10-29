import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { FIVE, FOUR, resultsWorld } from "./results-world";

/*
 * L17 Quyết định công nhận bổ sung (#88, spec #79 stories 56, 57, 60; ADR 0009). A hồ sơ 5 sao the Bộ trả về waits, still
 * Đã gửi đề nghị 5 sao, with the cờ chờ Quyết định công nhận bổ sung. The Cán bộ Sở picks such hồ sơ, sinh the dự thảo
 * (only mục 4 sao) and records the signed quyết định: each becomes Công nhận 3/4 sao with Hạng công nhận 4 and a Giấy
 * chứng nhận 4 sao. The kết quả chốt (Hạng sao 5, snapshot, hash) never changes.
 */
describe("L17 Quyết định công nhận bổ sung (#88)", () => {
  const { w, closedMeeting, record, decisionFile } = resultsWorld();

  const dossier = (dossierId: string) => w.t.app.dossiers.get(w.province, { dossierId });
  const ministryFile = () => w.f.uploadPdf(w.province, "ministry_document", "Văn bản của Bộ.pdf");

  /** A hồ sơ 5 sao Đã gửi đề nghị 5 sao; with `returned`, chuyển về công nhận cấp tỉnh. */
  async function sent({ returned = true } = {}) {
    const { meetingId, dossiers } = await closedMeeting([FIVE]);
    await record(meetingId);
    const d = dossiers[0]!;
    let { version } = await w.t.app.results.markFiveStarSent(w.province, {
      dossierId: d.dossierId,
      expectedVersion: (await dossier(d.dossierId)).version,
      dispatchNumber: "45/SNNMT-PTNT",
      sentOn: "2026-10-19",
    });
    if (returned) {
      ({ version } = await w.t.app.results.returnFiveStarToProvince(w.province, {
        dossierId: d.dossierId,
        expectedVersion: version,
        fileId: await ministryFile(),
      }));
    }
    return { ...d, version };
  }

  async function recordSupplementary(dossierIds: string[], input: { number?: string; signedOn?: string; fileId?: string } = {}) {
    return w.t.app.results.recordSupplementaryDecision(w.province, {
      dossierIds,
      number: input.number ?? "456/QĐ-UBND",
      signedOn: input.signedOn ?? "2026-10-19",
      fileId: input.fileId ?? (await decisionFile()),
    });
  }

  it("công nhận the hồ sơ chờ with Hạng công nhận 4 and a Giấy chứng nhận 4 sao, clearing the cờ (story 57)", async () => {
    const a = await sent();
    const b = await sent();

    const recorded = await recordSupplementary([b.dossierId, a.dossierId]);

    expect(recorded.dossiers).toEqual([a.dossierId, b.dossierId].sort().map((dossierId) => ({ dossierId, section: "four_star" })));
    for (const d of [a, b]) {
      expect(await dossier(d.dossierId)).toMatchObject({ state: "recognized", awaitingSupplementaryDecision: false });
    }
    const certificates = await w.t.app.results.listCertificates(w.province, { decisionId: recorded.decisionId });
    expect(certificates.map((c) => [c.dossier.id, c.recognizedStar]).sort()).toEqual([a.dossierId, b.dossierId].sort().map((id) => [id, 4]));
    expect(certificates.every((c) => /^\d{3}\/2026\/GCN-OCOP$/.test(c.code) && c.issuedOn === "2026-10-19")).toBe(true);
    expect((await w.t.app.results.fiveStarList(w.province)).some((r) => r.dossierId === a.dossierId)).toBe(false);
  });
  it("leaves the kết quả chốt, its snapshot and hash as they were: Hạng sao stays 5 (ADR 0009)", async () => {
    const d = await sent();
    const before = await w.t.app.scoring.readDossierScores(w.province, { dossierId: d.dossierId });
    const stored = async () =>
      (await w.db.admin.query("SELECT id, star, total, snapshot, sha256, superseded_at FROM scoring.aggregate_result WHERE dossier_id = $1", [d.dossierId]))
        .rows;
    const rows = await stored();

    await recordSupplementary([d.dossierId]);

    const after = await w.t.app.scoring.readDossierScores(w.province, { dossierId: d.dossierId });
    expect(before.kind).toBe("aggregate_only");
    expect(after).toMatchObject({ kind: "aggregate_only", aggregate: { star: 5 } });
    if (before.kind !== "aggregate_only" || after.kind !== "aggregate_only") throw new Error("aggregate_only expected");
    expect(after.result).toEqual(before.result);
    expect(after.aggregate).toEqual(before.aggregate);
    expect(await stored()).toEqual(rows);
  });

  it("shows the Chủ thể Hạng công nhận 4 beside Hạng sao 5 and tells it (stories 57, 60)", async () => {
    const d = await sent();
    await w.t.drainJobs();

    await recordSupplementary([d.dossierId]);
    await w.t.drainJobs();

    expect(await w.t.app.scoring.readDossierScores(d.a, { dossierId: d.dossierId })).toMatchObject({
      kind: "published_result",
      dossierState: "recognized",
      star: 5,
      outcome: "recognized",
      recognizedStar: 4,
      standing: "Công nhận 4 sao",
    });
    const inbox = await w.t.app.notifications.list(d.a);
    expect(inbox.filter((n) => n.kind === "dossier_recognized_supplementary" && n.link === `/chu-the/ho-so/${d.dossierId}`)).toHaveLength(1);
    const mail = w.t.mailbox.to(d.a.email).filter((e) => e.subject === "Hồ sơ OCOP đã được công nhận");
    expect(mail).toHaveLength(1);
    expect(mail[0]!.text).toContain(`/chu-the/ho-so/${d.dossierId}`);
  });
  it("names only hồ sơ chờ: not one Đã gửi without the cờ, nor one Công nhận already; nothing changes when one is refused", async () => {
    const waiting = await sent();
    const notReturned = await sent({ returned: false });
    const { meetingId, dossiers } = await closedMeeting([FOUR]);
    await record(meetingId);
    const four = dossiers[0]!.dossierId;

    await expect(recordSupplementary([waiting.dossierId, notReturned.dossierId])).rejects.toMatchObject({ code: "not_awaiting_supplementary_decision" });
    await expect(recordSupplementary([four])).rejects.toMatchObject({ code: "invalid_state" });
    await expect(recordSupplementary([])).rejects.toMatchObject({ code: "dossiers_required" });

    expect(await dossier(waiting.dossierId)).toMatchObject({ state: "five_star_proposed", version: waiting.version, awaitingSupplementaryDecision: true });
    const decisions = await w.db.admin.query("SELECT 1 FROM results.recognition_decision_dossier WHERE dossier_id = $1", [waiting.dossierId]);
    expect(decisions.rowCount).toBe(1); // only the quyết định theo Phiên họp, mục 5 sao
    expect((await w.t.app.results.listCertificates(w.province, {})).some((c) => c.dossier.id === waiting.dossierId)).toBe(false);

    // Once công nhận, it is not chờ any more.
    await recordSupplementary([waiting.dossierId]);
    await expect(recordSupplementary([waiting.dossierId])).rejects.toMatchObject({ code: "invalid_state" });
  });

  it("refuses without số quyết định, with a ngày ký invalid or in the future, or without the signed PDF", async () => {
    const d = await sent();
    await expect(recordSupplementary([d.dossierId], { number: " " })).rejects.toMatchObject({ code: "decision_number_required" });
    await expect(recordSupplementary([d.dossierId], { signedOn: "2026-02-30" })).rejects.toMatchObject({ code: "signed_on_invalid" });
    await expect(recordSupplementary([d.dossierId], { signedOn: "2026-10-20" })).rejects.toMatchObject({ code: "signed_on_in_future" });
    await expect(recordSupplementary([d.dossierId], { fileId: "0197a2b4-0000-7000-8000-000000000000" })).rejects.toMatchObject({ code: "file_required" });
    expect(await dossier(d.dossierId)).toMatchObject({ state: "five_star_proposed", version: d.version });
  });

  it("writes the decision kind supplementary without Phiên họp, audit, outbox and the Chủ thể's timeline mốc in the same transaction", async () => {
    const d = await sent();

    const { decisionId } = await recordSupplementary([d.dossierId], { number: " 456/QĐ-UBND " });

    const decision = await w.db.admin.query("SELECT kind, meeting_id, number, signed_on::text FROM results.recognition_decision WHERE id = $1", [decisionId]);
    expect(decision.rows).toEqual([{ kind: "supplementary", meeting_id: null, number: "456/QĐ-UBND", signed_on: "2026-10-19" }]);
    const events = await w.db.admin.query(
      "SELECT type FROM platform.outbox WHERE payload->>'dossierId' = $1 AND type IN ('dossier.recognized_supplementary', 'certificate.issued')",
      [d.dossierId],
    );
    expect(events.rows.map((r) => r.type).sort()).toEqual(["certificate.issued", "dossier.recognized_supplementary"]);
    const audit = await w.db.admin.query(
      "SELECT action, actor_user_id FROM platform.audit_log WHERE (target_id = $1 AND action = 'dossier.recognize_supplementary') OR (target_id = $2 AND action = 'results.decision.recorded')",
      [d.dossierId, decisionId],
    );
    expect(audit.rows.map((r) => r.action).sort()).toEqual(["dossier.recognize_supplementary", "results.decision.recorded"]);
    expect(audit.rows.every((r) => r.actor_user_id === w.province.userId)).toBe(true);
    const timeline = (await w.t.app.dossiers.timeline(d.a, { dossierId: d.dossierId })).map((e) => e.action);
    expect(timeline).toContain("dossier.recognize_supplementary");
  });

  it("corrects số or ngày ký of a quyết định bổ sung like one theo Phiên họp: giấy follow the ngày ký (story 17)", async () => {
    const d = await sent();
    const { decisionId } = await recordSupplementary([d.dossierId], { signedOn: "2026-10-18" });

    await w.t.app.results.amendDecision(w.province, { decisionId, number: "457/QĐ-UBND", signedOn: "2026-10-19", reason: "Sai ngày ký" });

    const [cert] = await w.t.app.results.listCertificates(w.province, { decisionId });
    expect(cert).toMatchObject({ recognizedStar: 4, issuedOn: "2026-10-19", decision: { number: "457/QĐ-UBND", signedOn: "2026-10-19" } });
    await expect(
      w.t.app.results.amendDecision(w.province, { decisionId, number: "457/QĐ-UBND", signedOn: "2025-12-31", reason: "Sai năm" }),
    ).rejects.toMatchObject({ code: "decision_year_change" });
  });
  it("the DB keeps a quyết định bổ sung to mục 4 sao (ADR 0009)", async () => {
    const d = await sent();
    const other = await sent();
    const { decisionId } = await recordSupplementary([d.dossierId]);

    await expect(
      w.db.app.query("INSERT INTO results.recognition_decision_dossier (decision_id, dossier_id, section) VALUES ($1, $2, 'three_star')", [
        decisionId,
        other.dossierId,
      ]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      w.db.app.query("INSERT INTO results.recognition_decision_dossier (decision_id, dossier_id, section) VALUES ($1, $2, 'five_star_proposal')", [
        decisionId,
        other.dossierId,
      ]),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("sinh the dự thảo from the mẫu quyết định with only mục 4 sao and the cờ bổ sung; nothing changes (story 56)", async () => {
    const a = await sent();
    const b = await sent();
    const notPicked = await sent();

    const { fileName, bytes } = await w.t.app.results.supplementaryDecisionDraft(w.province, { dossierIds: [a.dossierId, b.dossierId] });

    expect(fileName).toMatch(/^Dự thảo quyết định công nhận bổ sung.*\.docx$/);
    const text = docxText(bytes);
    expect(text).toContain("Về việc công nhận bổ sung sản phẩm đạt chuẩn OCOP");
    expect(text).toContain("Điều 1. Công nhận 2 sản phẩm đạt chuẩn OCOP");
    expect(text).not.toContain("Phiên họp xét công nhận");
    const rows = text.split("\n").filter((l) => l.includes(" | 4 sao | "));
    expect(rows).toHaveLength(2);
    expect(text).not.toContain("5 sao |");
    expect(text).toContain("1. Sản phẩm được công nhận đạt 4 sao (2 sản phẩm)");
    expect(text).not.toContain("phân hạng 5 sao");
    expect(rows.every((r) => r.includes("Hạng sao theo kết quả chốt: 5 sao"))).toBe(true);

    for (const d of [a, b, notPicked]) expect(await dossier(d.dossierId)).toMatchObject({ state: "five_star_proposed", version: d.version });
  });

  it("lists the quyết định bổ sung, newest first, with their hồ sơ, and not those theo Phiên họp", async () => {
    const a = await sent();
    const { decisionId } = await recordSupplementary([a.dossierId], { number: "456/QĐ-UBND" });

    const list = await w.t.app.results.supplementaryDecisions(w.province);

    expect(list.find((d) => d.id === decisionId)).toMatchObject({
      kind: "supplementary",
      number: "456/QĐ-UBND",
      signedOn: "2026-10-19",
      file: { fileName: "QĐ công nhận.pdf" },
      recordedBy: { userId: w.province.userId },
      dossiers: [{ dossierId: a.dossierId, code: expect.any(String), productName: expect.any(String) }],
    });
    expect(list.every((d) => d.kind === "supplementary")).toBe(true);
  });

  it("sinh the dự thảo only for hồ sơ chờ", async () => {
    const notReturned = await sent({ returned: false });
    await expect(w.t.app.results.supplementaryDecisionDraft(w.province, { dossierIds: [notReturned.dossierId] })).rejects.toMatchObject({
      code: "not_awaiting_supplementary_decision",
    });
    await expect(w.t.app.results.supplementaryDecisionDraft(w.province, { dossierIds: [] })).rejects.toMatchObject({ code: "dossiers_required" });
  });

  it("the dự thảo theo Phiên họp keeps its wording, without the cờ bổ sung", async () => {
    const { meetingId } = await closedMeeting([FOUR]);
    const { bytes } = await w.t.app.scoring.generateMeetingDocument(w.A.secretary, { meetingId, kind: "decision" });
    const text = docxText(bytes);
    expect(text).toContain("Về việc công nhận sản phẩm đạt chuẩn OCOP");
    expect(text).toContain("Phiên họp xét công nhận");
    expect(text).not.toContain("bổ sung");
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
