import ExcelJS from "exceljs";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { FIVE, FOUR, resultsWorld } from "./results-world";

/*
 * L17 SO-04 Gói đề nghị 5 sao (#89, spec #79 stories 47 to 52, 61). The Cán bộ Sở picks hồ sơ of the "Đề xuất 5 sao"
 * list and exports one ZIP: a folder per hồ sơ, the dự thảo văn bản đề nghị of the UBND tỉnh and a mục lục PDF at the
 * root. A job builds it and streams it to object storage; the Sở is told in the app when it can be downloaded.
 */
describe("L17 Gói đề nghị 5 sao (#89)", () => {
  const { w, m, closedMeeting, record } = resultsWorld();

  /** Hồ sơ 5 sao whose Quyết định công nhận is recorded: Đã chốt điểm, Công bố, in the "Đề xuất 5 sao" list. */
  async function proposed(count = 1) {
    const { meetingId, dossiers } = await closedMeeting(Array.from({ length: count }, () => FIVE));
    await record(meetingId);
    return { meetingId, dossierIds: dossiers.map((d) => d.dossierId) };
  }

  /** The ZIP of a ready package, fetched through its pre-signed link. */
  async function zipOf(packageId: string) {
    const { url } = await w.t.app.results.downloadFiveStarPackage(w.province, { packageId });
    const res = await fetch(url);
    expect(res.status).toBe(200);
    return new PizZip(Buffer.from(await res.arrayBuffer()));
  }

  const entries = (zip: PizZip) =>
    Object.values(zip.files)
      .filter((f) => !f.dir)
      .map((f) => f.name)
      .sort();

  it("builds the package in a job: ready to download, with the văn bản đề nghị and the mục lục at the root (stories 47, 49 to 51)", async () => {
    const { dossierIds } = await proposed();

    const { packageId } = await w.t.app.results.requestFiveStarPackage(w.province, { dossierIds });
    expect((await w.t.app.results.fiveStarPackages(w.province)).find((p) => p.id === packageId)).toMatchObject({ state: "pending" });

    await w.t.drainJobs();

    expect((await w.t.app.results.fiveStarPackages(w.province)).find((p) => p.id === packageId)).toMatchObject({ state: "ready" });
    const names = entries(await zipOf(packageId));
    expect(names).toContain("De nghi UBND tinh.docx");
    expect(names).toContain("Muc luc.pdf");
  });

  it("puts each hồ sơ in a folder '<mã hồ sơ> - <tên sản phẩm>' with what the Bộ asks for, file names without dấu (story 48)", async () => {
    const draft = {
      evidence: [
        { fileName: "Hợp đồng thu mua.pdf", criteria: ["1.1", "2.1"] },
        { fileName: "Ảnh sản phẩm.pdf", criteria: [] },
      ],
    };
    const { meetingId, dossiers } = await closedMeeting([FIVE], draft);
    for (const name of ["Biên bản đã ký.pdf", "Biên bản đã ký lần 2.pdf"]) {
      const fileId = await w.f.uploadPdf(w.A.secretary, "meeting_minutes", name);
      await w.t.app.scoring.attachMeetingMinutes(w.A.secretary, { meetingId, fileId });
    }
    await record(meetingId);
    const dossierId = dossiers[0]!.dossierId;
    const { code } = await w.t.app.dossiers.get(w.province, { dossierId });

    const { packageId } = await w.t.app.results.requestFiveStarPackage(w.province, { dossierIds: [dossierId] });
    await w.t.drainJobs();
    const zip = await zipOf(packageId);

    const folder = `${code} - Buoi da xanh An Phu`;
    expect(entries(zip)).toEqual(
      [
        "De nghi UBND tinh.docx",
        "Muc luc.pdf",
        `${folder}/01 Phien ban nop 1/Phieu dang ky.docx`,
        `${folder}/01 Phien ban nop 1/Bao cao tu danh gia.docx`,
        `${folder}/01 Phien ban nop 1/Giay to phap ly/GPKD.pdf`,
        `${folder}/02 Minh chung/1.1 Tieu chi 1.1/Hop dong thu mua.pdf`,
        `${folder}/02 Minh chung/2.1 Tieu chi 2.1/Hop dong thu mua.pdf`,
        `${folder}/02 Minh chung/Chua gan tieu chi/Anh san pham.pdf`,
        `${folder}/04 Bien ban hop/Bien ban da ky lan 2.pdf`,
        `${folder}/05 Bang diem.xlsx`,
        `${folder}/06 Quyet dinh cong nhan/QD cong nhan.pdf`,
      ].sort(),
    );

    // The bảng điểm is the hồ sơ's own, from the snapshot of its kết quả chốt: each thành viên by name, with điểm.
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(zip.file(`${folder}/05 Bang diem.xlsx`)!.asNodeBuffer() as unknown as ArrayBuffer);
    const text = book.worksheets.flatMap((s) => s.getSheetValues().flatMap((row) => (Array.isArray(row) ? row.map((v) => String(v ?? "")) : []))).join("|");
    expect(text).toContain(m(0).fullName);
    expect(text).toContain(m(1).fullName);
    expect(text).toContain("Tiêu chí 1.1");
    expect(text).toContain("100");
    expect(text).not.toContain(m(2).fullName);
  });

  it("lists every hồ sơ picked in the dự thảo văn bản đề nghị, and every file by folder in the mục lục PDF (stories 49, 50)", async () => {
    const { dossierIds } = await proposed(2);
    const codes = await Promise.all(dossierIds.map(async (dossierId) => (await w.t.app.dossiers.get(w.province, { dossierId })).code));

    const { packageId } = await w.t.app.results.requestFiveStarPackage(w.province, { dossierIds });
    const before = w.t.pdf.count;
    await w.t.drainJobs();
    const zip = await zipOf(packageId);

    const letter = docxText(zip.file("De nghi UBND tinh.docx")!.asUint8Array());
    for (const code of codes) expect(letter).toContain(code);
    expect(letter).toContain("Bưởi da xanh An Phú");
    expect(letter).toContain("100");

    // The mục lục went through the PdfConverter; the PDF it returned is the one in the ZIP.
    expect(w.t.pdf.count).toBe(before + 1);
    const index = docxText(w.t.pdf.calls.at(-1)!);
    for (const code of codes) {
      expect(index).toContain(`${code} - Buoi da xanh An Phu`);
      expect(index).toContain("05 Bang diem.xlsx");
    }
    expect(index).toContain("01 Phien ban nop 1/Phieu dang ky.docx");
    expect(index).toContain("De nghi UBND tinh.docx");
    expect(Buffer.from(zip.file("Muc luc.pdf")!.asUint8Array()).subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("L17 Gói đề nghị 5 sao (#89): what may be exported, and what it records", () => {
  const { w, closedMeeting, record } = resultsWorld();

  it("refuses a hồ sơ not in the 'Đề xuất 5 sao' list, and an empty selection, recording nothing", async () => {
    const unpublished = await closedMeeting([FIVE]);
    const { meetingId, dossiers } = await closedMeeting([FOUR, FIVE]);
    await record(meetingId);
    const [four, five] = dossiers.map((d) => d.dossierId) as [string, string];
    const before = (await w.t.app.results.fiveStarPackages(w.province)).length;

    const request = (dossierIds: string[]) => w.t.app.results.requestFiveStarPackage(w.province, { dossierIds });
    await expect(request([five, four])).rejects.toMatchObject({ code: "not_five_star_candidate" });
    await expect(request([unpublished.dossiers[0]!.dossierId])).rejects.toMatchObject({ code: "not_five_star_candidate" });
    await expect(request(["not-a-uuid"])).rejects.toMatchObject({ code: "not_five_star_candidate" });
    await expect(request([])).rejects.toMatchObject({ code: "dossiers_required" });
    expect(await w.t.app.results.fiveStarPackages(w.province)).toHaveLength(before);
  });

  it("audits the request as access to điểm từng thành viên of each hồ sơ, and changes no hồ sơ however often it is exported (stories 52, 61)", async () => {
    const { meetingId, dossiers } = await closedMeeting([FIVE, FIVE]);
    await record(meetingId);
    const ids = dossiers.map((d) => d.dossierId);
    const before = await Promise.all(ids.map((dossierId) => w.t.app.dossiers.get(w.province, { dossierId })));

    const first = await w.t.app.results.requestFiveStarPackage(w.province, { dossierIds: ids });
    const second = await w.t.app.results.requestFiveStarPackage(w.province, { dossierIds: [ids[1]!] });
    await w.t.drainJobs();

    const after = await Promise.all(ids.map((dossierId) => w.t.app.dossiers.get(w.province, { dossierId })));
    expect(after.map((d) => [d.state, d.version])).toEqual(before.map((d) => [d.state, d.version]));
    const packages = await w.t.app.results.fiveStarPackages(w.province);
    expect(packages.filter((p) => [first.packageId, second.packageId].includes(p.id)).map((p) => p.state)).toEqual(["ready", "ready"]);

    const { rows } = await w.db.admin.query(
      `select actor_user_id, target_id, metadata from platform.audit_log
        where action = 'personal_data.viewed' and metadata->>'view' = 'five_star_package' and metadata->>'packageId' = $1 order by target_id`,
      [first.packageId],
    );
    expect(rows.map((r) => r.target_id)).toEqual([...ids].sort());
    expect(rows.every((r) => r.actor_user_id === w.province.userId)).toBe(true);
    const { rows: requested } = await w.db.admin.query(
      `select metadata from platform.audit_log where action = 'results.package.requested' and target_id = $1`,
      [first.packageId],
    );
    expect(requested).toEqual([{ metadata: { dossierIds: ids } }]);
  });
});

describe("L17 Gói đề nghị 5 sao (#89): notices, hạn tải and failure", () => {
  const { w, closedMeeting, record } = resultsWorld();

  async function proposed() {
    const { meetingId, dossiers } = await closedMeeting([FIVE]);
    await record(meetingId);
    return dossiers.map((d) => d.dossierId);
  }

  it("tells the Cán bộ Sở who asked, in the app, with the link to download; the link works for 7 days (story 51)", async () => {
    const dossierIds = await proposed();
    const other = await w.f.staff("province_officer");
    const { packageId } = await w.t.app.results.requestFiveStarPackage(w.province, { dossierIds });
    await expect(w.t.app.results.downloadFiveStarPackage(w.province, { packageId })).rejects.toMatchObject({ code: "package_not_ready" });
    await w.t.drainJobs();

    const notices = (await w.t.app.notifications.list(w.province)).filter((n) => n.kind === "five_star_package_ready");
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ title: "Gói đề nghị 5 sao đã sẵn sàng", link: `/so/ho-so-5-sao/goi/${packageId}` });
    expect((await w.t.app.notifications.list(other)).some((n) => n.kind.startsWith("five_star_package"))).toBe(false);

    const ready = (await w.t.app.results.fiveStarPackages(w.province)).find((p) => p.id === packageId)!;
    expect(ready.expiresAt).toEqual(new Date(w.t.clock.now().getTime() + 7 * 86_400_000));
    await expect(w.t.app.results.downloadFiveStarPackage(other, { packageId })).resolves.toMatchObject({ fileName: expect.stringMatching(/\.zip$/) });

    w.t.clock.advance(7 * 86_400_000);
    await expect(w.t.app.results.downloadFiveStarPackage(w.province, { packageId })).rejects.toMatchObject({ code: "package_expired" });
    expect((await w.t.app.results.fiveStarPackages(w.province)).find((p) => p.id === packageId)).toMatchObject({ state: "ready", expired: true });
  });

  it("marks the package failed and tells the Sở when it cannot be built; exporting again works (story 52)", async () => {
    const dossierIds = await proposed();
    w.t.pdf.failNext(1);
    const failed = await w.t.app.results.requestFiveStarPackage(w.province, { dossierIds });
    await w.t.drainJobs();

    expect((await w.t.app.results.fiveStarPackages(w.province)).find((p) => p.id === failed.packageId)).toMatchObject({
      state: "failed",
      failure: expect.any(String),
    });
    await expect(w.t.app.results.downloadFiveStarPackage(w.province, { packageId: failed.packageId })).rejects.toMatchObject({ code: "package_not_ready" });
    expect((await w.t.app.notifications.list(w.province)).find((n) => n.kind === "five_star_package_failed")).toMatchObject({
      title: "Không tạo được gói đề nghị 5 sao",
    });

    const again = await w.t.app.results.requestFiveStarPackage(w.province, { dossierIds });
    await w.t.drainJobs();
    expect((await w.t.app.results.fiveStarPackages(w.province)).find((p) => p.id === again.packageId)).toMatchObject({ state: "ready" });
  });
});

describe("L17 Gói đề nghị 5 sao (#89): the record of an export", () => {
  const { w, closedMeeting, record } = resultsWorld();

  it("is finished once: the app's database user cannot change a ready package nor delete one (trigger)", async () => {
    const { meetingId, dossiers } = await closedMeeting([FIVE]);
    await record(meetingId);
    const { packageId } = await w.t.app.results.requestFiveStarPackage(w.province, { dossierIds: [dossiers[0]!.dossierId] });
    await w.t.drainJobs();

    await expect(w.db.app.query("update results.five_star_package set state = 'failed', failure = 'x' where id = $1", [packageId])).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      w.db.app.query("update results.five_star_package set expires_at = now() + interval '1 year' where id = $1", [packageId]),
    ).rejects.toMatchObject({
      code: "42501",
    });
    await expect(w.db.app.query("delete from results.five_star_package where id = $1", [packageId])).rejects.toMatchObject({ code: "42501" });
  });
});

/** The text of a DOCX, paragraphs joined by newlines. */
function docxText(bytes: Uint8Array) {
  const xml = new PizZip(Buffer.from(bytes)).file("word/document.xml")!.asText();
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&");
}
