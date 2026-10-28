import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { FIVE, FOUR, resultsWorld, THREE, TWO } from "./results-world";

/*
 * L16 HD-11 (#84, spec #79 stories 17, 18, 22 to 31, 34, 35): each hồ sơ a Quyết định công nhận recognizes gets one
 * Giấy chứng nhận, numbered in the transaction that records the quyết định; its bản nháp PDF is generated afterwards by
 * an outbox consumer; the Cán bộ Sở uploads the signed PDF, and may correct the số or ngày ký of the quyết định.
 */
describe("L16 Giấy chứng nhận (#84)", () => {
  const { w, closedMeeting, record, decisionFile } = resultsWorld();

  const certificatesOf = (decisionId: string) => w.t.app.results.listCertificates(w.province, { decisionId });
  const signedFile = (name = "GCN đã ký.pdf") => w.f.uploadPdf(w.province, "signed_certificate", name);
  const docxText = (bytes: Uint8Array) =>
    new PizZip(bytes)
      .file("word/document.xml")!
      .asText()
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "");

  /** A recorded quyết định of one hồ sơ 3 sao and one 4 sao, its bản nháp generated. */
  async function recorded(signedOn = "2026-10-19") {
    const { meetingId, dossiers } = await closedMeeting([THREE, FOUR]);
    const decision = await record(meetingId, w.province, { signedOn });
    await w.t.drainJobs();
    return { ...decision, dossiers, certificates: await certificatesOf(decision.decisionId) };
  }

  it("issues one Giấy chứng nhận per hồ sơ 3 and 4 sao, numbered by Hạng công nhận then mã hồ sơ, dated by the ngày ký (stories 22 to 24, 31)", async () => {
    const { meetingId, dossiers } = await closedMeeting([THREE, FOUR, FIVE, TWO, FOUR]);
    const [three, fourA, , , fourB] = dossiers.map((d) => d.dossierId) as [string, string, string, string, string];

    const { decisionId } = await record(meetingId, w.province, { signedOn: "2026-10-19" });

    const certs = await certificatesOf(decisionId);
    expect(certs.map((c) => [c.dossier.id, c.recognizedStar])).toEqual([
      [fourA, 4],
      [fourB, 4],
      [three, 3],
    ]);
    const seqs = certs.map((c) => c.seq);
    expect(seqs[1]).toBe(seqs[0]! + 1);
    expect(seqs[2]).toBe(seqs[0]! + 2);
    for (const c of certs) {
      expect(c.code).toBe(`${String(c.seq).padStart(3, "0")}/2026/GCN-OCOP`);
      expect(c).toMatchObject({
        year: 2026,
        issuedOn: "2026-10-19",
        expiresOn: "2029-10-19",
        state: "awaiting_signature",
        decision: { id: decisionId, number: "123/QĐ-UBND", signedOn: "2026-10-19" },
      });
    }
  });

  it("generates the bản nháp PDF after the recording, from the mẫu certificate; until then the giấy is đang tạo (story 26)", async () => {
    const { meetingId } = await closedMeeting([FOUR]);
    const pdfBefore = w.t.pdf.count;
    const { decisionId } = await record(meetingId, w.province, { number: "77/QĐ-UBND", signedOn: "2026-10-18" });

    const [pending] = await certificatesOf(decisionId);
    expect(pending!.draft).toBe("generating");
    expect(w.t.pdf.count).toBe(pdfBefore);
    await expect(w.t.app.results.downloadCertificate(w.province, { certificateId: pending!.id, version: "draft" })).rejects.toMatchObject({
      code: "certificate_draft_pending",
    });

    await w.t.drainJobs();

    const [ready] = await certificatesOf(decisionId);
    expect(ready!.draft).toBe("ready");
    expect(w.t.pdf.count).toBe(pdfBefore + 1);
    const text = docxText(w.t.pdf.calls.at(-1)!);
    expect(text).toContain(ready!.code);
    expect(text).toContain(ready!.dossier.productName);
    expect(text).toContain("4 sao");
    expect(text).toContain("77/QĐ-UBND");
    expect(text).toContain("18/10/2026");
    expect(text).toContain("18/10/2029");
    const { url } = await w.t.app.results.downloadCertificate(w.province, { certificateId: ready!.id, version: "draft" });
    const res = await fetch(url);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect((await res.text()).startsWith("%PDF")).toBe(true);
  });

  it("retries the bản nháp when the PDF conversion fails", async () => {
    const { meetingId } = await closedMeeting([THREE]);
    const { decisionId } = await record(meetingId);
    w.t.pdf.failNext(1);
    await w.t.drainJobs();
    expect((await certificatesOf(decisionId))[0]!.draft).toBe("generating");
    await w.t.drainJobs({ includeRetries: true });
    expect((await certificatesOf(decisionId))[0]!.draft).toBe("ready");
  });

  it("puts every bản nháp of a quyết định in one download (story 27)", async () => {
    const { decisionId, certificates } = await recorded();
    const { fileName, files } = await w.t.app.results.certificateDrafts(w.province, { decisionId });
    expect(fileName).toBe("Giay chung nhan - QD 123-QĐ-UBND.zip");
    expect(files.map((f) => f.name)).toEqual(certificates.map((c) => `Giay chung nhan ${c.code.replaceAll("/", "-")}.pdf`));
    expect(Buffer.from(files[0]!.bytes).subarray(0, 4).toString()).toBe("%PDF");
  });

  it("moves a giấy to Đã ký with its signed PDF; a re-upload needs a lý do and keeps the earlier one (stories 28, 29)", async () => {
    const { certificates } = await recorded();
    const cert = certificates[0]!;

    const first = await signedFile("lan-1.pdf");
    expect(await w.t.app.results.uploadSignedCertificate(w.province, { certificateId: cert.id, fileId: first })).toEqual({ n: 1, state: "signed" });

    const second = await signedFile("lan-2.pdf");
    await expect(w.t.app.results.uploadSignedCertificate(w.province, { certificateId: cert.id, fileId: second })).rejects.toMatchObject({
      code: "reason_required",
    });
    expect(await w.t.app.results.uploadSignedCertificate(w.province, { certificateId: cert.id, fileId: second, reason: "Tải nhầm tệp" })).toEqual({
      n: 2,
      state: "signed",
    });

    const [view] = (await w.t.app.results.listCertificates(w.province, { state: "signed" })).filter((c) => c.id === cert.id);
    expect(view).toMatchObject({ state: "signed", signedCount: 2 });
    const rows = await w.db.admin.query("SELECT n, file_id, reason FROM results.certificate_signed_file WHERE certificate_id = $1 ORDER BY n", [cert.id]);
    expect(rows.rows).toEqual([
      { n: 1, file_id: first, reason: null },
      { n: 2, file_id: second, reason: "Tải nhầm tệp" },
    ]);
    const { url } = await w.t.app.results.downloadCertificate(w.province, { certificateId: cert.id, version: "signed" });
    expect(url).toContain("lan-2");
    const events = await w.db.admin.query(
      "SELECT payload->>'n' AS n FROM platform.outbox WHERE type = 'certificate.signed' AND payload->>'certificateId' = $1",
      [cert.id],
    );
    expect(events.rows.map((r) => r.n).sort()).toEqual(["1", "2"]);
    const audit = await w.db.admin.query("SELECT metadata->>'n' AS n FROM platform.audit_log WHERE action = 'results.certificate.signed' AND target_id = $1", [
      cert.id,
    ]);
    expect(audit.rowCount).toBe(2);
  });

  it("filters the list by năm, trạng thái and quyết định (story 34)", async () => {
    const { decisionId, certificates } = await recorded();
    expect((await w.t.app.results.listCertificates(w.province, { decisionId })).map((c) => c.id)).toEqual(certificates.map((c) => c.id));
    expect((await w.t.app.results.listCertificates(w.province, { year: 2025 })).length).toBe(0);
    const waiting = await w.t.app.results.listCertificates(w.province, { year: 2026, state: "awaiting_signature" });
    expect(waiting.every((c) => c.state === "awaiting_signature" && c.year === 2026)).toBe(true);
    expect(waiting.map((c) => c.id)).toEqual(expect.arrayContaining(certificates.map((c) => c.id)));
  });

  it("corrects the số and ngày ký with a lý do: ngày cấp and hết hiệu lực follow, số hiệu stays, bản nháp of Chờ ký regenerated (stories 17, 30)", async () => {
    const { decisionId, certificates } = await recorded("2026-10-19");
    const [signed, waiting] = certificates as [(typeof certificates)[0], (typeof certificates)[0]];
    await w.t.app.results.uploadSignedCertificate(w.province, { certificateId: signed.id, fileId: await signedFile() });
    const pdfBefore = w.t.pdf.count;

    await expect(w.t.app.results.amendDecision(w.province, { decisionId, number: "124/QĐ-UBND", signedOn: "2026-10-15", reason: " " })).rejects.toMatchObject({
      code: "reason_required",
    });
    const result = await w.t.app.results.amendDecision(w.province, {
      decisionId,
      number: "124/QĐ-UBND",
      signedOn: "2026-10-15",
      reason: "Nhập nhầm số quyết định",
    });
    expect(result).toEqual({ number: "124/QĐ-UBND", signedOn: "2026-10-15", certificates: 2 });

    const after = await certificatesOf(decisionId);
    for (const c of after) {
      expect(c).toMatchObject({ issuedOn: "2026-10-15", expiresOn: "2029-10-15", decision: { number: "124/QĐ-UBND", signedOn: "2026-10-15" } });
    }
    expect(after.map((c) => c.code)).toEqual(certificates.map((c) => c.code));
    expect(after.find((c) => c.id === waiting.id)!.draft).toBe("generating");
    expect(after.find((c) => c.id === signed.id)!.draft).toBe("ready");

    await w.t.drainJobs();
    expect(w.t.pdf.count).toBe(pdfBefore + 1);
    expect(docxText(w.t.pdf.calls.at(-1)!)).toContain("124/QĐ-UBND");
    expect((await certificatesOf(decisionId)).find((c) => c.id === waiting.id)!.draft).toBe("ready");

    const view = await w.t.app.results.meetingsForDecision(w.province);
    expect(view.find((m) => m.decision?.id === decisionId)!.decision).toMatchObject({ number: "124/QĐ-UBND", signedOn: "2026-10-15" });
    const audit = await w.db.admin.query(
      "SELECT before, after, metadata FROM platform.audit_log WHERE action = 'results.decision.amended' AND target_id = $1",
      [decisionId],
    );
    expect(audit.rows).toEqual([
      expect.objectContaining({
        before: { number: "123/QĐ-UBND", signedOn: "2026-10-19" },
        after: { number: "124/QĐ-UBND", signedOn: "2026-10-15" },
        metadata: expect.objectContaining({ reason: "Nhập nhầm số quyết định" }),
      }),
    ]);
  });

  it("keeps each giấy's thời hạn hiệu lực when the quyết định is corrected after Quản trị changes the setting", async () => {
    const admin = await w.f.admin();
    const { decisionId } = await recorded("2026-01-31"); // 36 tháng → 31/01/2029
    await w.t.app.system.setCertificateSettings(admin, { codeSuffix: "GCN-OCOP", validityMonths: 24, expiryReminderMonths: 6 });
    try {
      await w.t.app.results.amendDecision(w.province, { decisionId, number: "123/QĐ-UBND", signedOn: "2026-02-28", reason: "Sửa ngày ký" });
      for (const c of await certificatesOf(decisionId)) expect(c).toMatchObject({ issuedOn: "2026-02-28", expiresOn: "2029-02-28" });
    } finally {
      await w.t.app.system.setCertificateSettings(admin, { codeSuffix: "GCN-OCOP", validityMonths: 36, expiryReminderMonths: 6 });
    }
  });

  it("refuses moving the ngày ký to another year (story 18)", async () => {
    const { decisionId } = await recorded("2026-01-05");
    await expect(
      w.t.app.results.amendDecision(w.province, { decisionId, number: "123/QĐ-UBND", signedOn: "2025-12-31", reason: "Sửa ngày" }),
    ).rejects.toMatchObject({ code: "decision_year_change" });
  });

  it("never numbers two giấy alike when two quyết định are recorded at once (story 25)", async () => {
    const a = await closedMeeting([THREE, FOUR]);
    const b = await closedMeeting([FOUR, THREE]);
    const fileA = await decisionFile();
    const fileB = await decisionFile();
    const [da, db] = await Promise.all([
      w.t.app.results.recordMeetingDecision(w.province, { meetingId: a.meetingId, number: "1/QĐ", signedOn: "2026-10-19", fileId: fileA }),
      w.t.app.results.recordMeetingDecision(w.province, { meetingId: b.meetingId, number: "2/QĐ", signedOn: "2026-10-19", fileId: fileB }),
    ]);
    const seqs = [...(await certificatesOf(da.decisionId)), ...(await certificatesOf(db.decisionId))].map((c) => c.seq);
    expect(new Set(seqs).size).toBe(4);
    const all = await w.db.admin.query("SELECT year, seq FROM results.certificate");
    expect(new Set(all.rows.map((r) => `${r.year}/${r.seq}`)).size).toBe(all.rowCount);
  });

  it("uses the đuôi Quản trị sets, and keeps the số hiệu already issued (story 35)", async () => {
    const admin = await w.f.admin();
    expect(await w.t.app.system.certificateSettings(admin)).toEqual({ codeSuffix: "GCN-OCOP", validityMonths: 36, expiryReminderMonths: 6 });
    const before = await recorded();
    await w.t.app.system.setCertificateSettings(admin, { codeSuffix: "GCN-OCOP-T", validityMonths: 24, expiryReminderMonths: 3 });
    try {
      const after = await recorded();
      expect(after.certificates.every((c) => c.code.endsWith("/2026/GCN-OCOP-T") && c.expiresOn === "2028-10-19")).toBe(true);
      expect((await certificatesOf(before.decisionId)).map((c) => c.code)).toEqual(before.certificates.map((c) => c.code));
      const [entry] = await w.t.app.audit.search(admin, { action: ["system.certificate_settings_changed"] });
      expect(entry).toMatchObject({ after: { codeSuffix: "GCN-OCOP-T", validityMonths: 24, expiryReminderMonths: 3 } });
    } finally {
      await w.t.app.system.setCertificateSettings(admin, { codeSuffix: "GCN-OCOP", validityMonths: 36, expiryReminderMonths: 6 });
    }
  });

  it.each([
    [{ codeSuffix: "", validityMonths: 36, expiryReminderMonths: 6 }],
    [{ codeSuffix: "GCN/OCOP", validityMonths: 36, expiryReminderMonths: 6 }],
    [{ codeSuffix: "GCN-OCOP", validityMonths: 0, expiryReminderMonths: 6 }],
    [{ codeSuffix: "GCN-OCOP", validityMonths: 36, expiryReminderMonths: 36 }],
    [{ codeSuffix: "GCN-OCOP", validityMonths: 36.5, expiryReminderMonths: 6 }],
  ])("refuses the settings %j", async (input) => {
    const admin = await w.f.admin();
    await expect(w.t.app.system.setCertificateSettings(admin, input)).rejects.toMatchObject({ code: "invalid_certificate_settings" });
  });

  it("restarts the số thứ tự at 1 in a new year (story 23)", async () => {
    const { meetingId } = await closedMeeting([THREE, FOUR]);
    const at = w.t.clock.now();
    w.t.clock.set(new Date("2027-01-10T03:00:00Z"));
    try {
      const { decisionId } = await record(meetingId, w.province, { signedOn: "2027-01-08" });
      expect((await certificatesOf(decisionId)).map((c) => c.code)).toEqual(["001/2027/GCN-OCOP", "002/2027/GCN-OCOP"]);
    } finally {
      w.t.clock.set(at);
    }
  });

  it("writes the audit row and the certificate.issued event in the transaction that records the quyết định", async () => {
    const { meetingId } = await closedMeeting([THREE]);
    const { decisionId } = await record(meetingId);
    const [cert] = await certificatesOf(decisionId);
    const audit = await w.db.admin.query("SELECT actor_user_id, after FROM platform.audit_log WHERE action = 'results.certificate.issued' AND target_id = $1", [
      cert!.id,
    ]);
    expect(audit.rows).toEqual([{ actor_user_id: w.province.userId, after: expect.objectContaining({ code: cert!.code, recognizedStar: 3 }) }]);
    const events = await w.db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'certificate.issued' AND payload->>'certificateId' = $1", [
      cert!.id,
    ]);
    expect(events.rows).toEqual([{ payload: expect.objectContaining({ dossierId: cert!.dossier.id, decisionId }) }]);
  });

  it("the DB keeps the số hiệu, refuses removing a giấy, and keeps every signed PDF", async () => {
    const { certificates } = await recorded();
    const cert = certificates[0]!;
    await w.t.app.results.uploadSignedCertificate(w.province, { certificateId: cert.id, fileId: await signedFile() });
    await expect(w.db.app.query("UPDATE results.certificate SET code = 'x' WHERE id = $1", [cert.id])).rejects.toThrow();
    await expect(w.db.admin.query("UPDATE results.certificate SET seq = seq + 1000 WHERE id = $1", [cert.id])).rejects.toThrow(/never change/);
    await expect(w.db.admin.query("UPDATE results.certificate SET state = 'awaiting_signature' WHERE id = $1", [cert.id])).rejects.toThrow(/never change/);
    await expect(w.db.admin.query("DELETE FROM results.certificate WHERE id = $1", [cert.id])).rejects.toThrow(/never removed/);
    await expect(w.db.admin.query("UPDATE results.certificate_signed_file SET reason = 'x' WHERE certificate_id = $1", [cert.id])).rejects.toThrow(
      /kept as it was/,
    );
    await expect(w.db.admin.query("DELETE FROM results.certificate_signed_file WHERE certificate_id = $1", [cert.id])).rejects.toThrow(/kept as it was/);
  });
});
