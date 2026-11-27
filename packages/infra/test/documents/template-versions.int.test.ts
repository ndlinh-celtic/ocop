import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import PizZip from "pizzip";
import type { DocumentTemplate, UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "../dossiers/fixtures";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TITLE = "PHIẾU ĐĂNG KÝ SẢN PHẨM THAM GIA ĐÁNH GIÁ, PHÂN HẠNG SẢN PHẨM OCOP";

let db: TestDatabase;
let t: TestApp;
let f: ReturnType<typeof fixtures>;
let admin: UserActor;
let sets: Record<string, string>;
const START = new Date("2026-10-19T02:00:00Z");

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n");
  const wardId = (await t.app.org.listWards())[0]!.id;
  f = fixtures(t, () => wardId);
  t.clock.set(START);
  admin = await f.admin();
  const version = await f.publishedVersion("26/2026/QĐ-TTg");
  sets = version.sets;
  await f.openRound(version.versionId);
});
beforeEach(() => t.clock.set(START));
afterAll(async () => {
  await t.stop();
  await db.drop();
});

const textOf = (bytes: Uint8Array) =>
  new PizZip(bytes)
    .file("word/document.xml")!
    .asText()
    .replace(/<[^>]+>/g, "");

/** A template's word/document.xml with `from` replaced: what the Quản trị does in Word. */
function edited(bytes: Uint8Array, from: string | RegExp, to: string) {
  const zip = new PizZip(bytes);
  const xml = zip.file("word/document.xml")!.asText();
  const next = xml.replace(from, to);
  if (next === xml) throw new Error(`nothing replaced: ${from}`);
  zip.file("word/document.xml", next);
  return zip.generate({ type: "uint8array" });
}

/** Uploads bytes as a `document_template` file through the files flow (PUT, then the scan) and returns its id. */
async function uploadDocx(actor: UserActor, bytes: Uint8Array, fileName = "Mẫu.docx") {
  const { fileId, upload } = await t.app.files.requestUpload(actor, { purpose: "document_template", fileName, contentType: DOCX, size: bytes.byteLength });
  if (upload.kind !== "single") throw new Error("expected a single PUT");
  const res = await fetch(upload.url, { method: "PUT", headers: upload.headers, body: bytes });
  if (!res.ok) throw new Error(`PUT ${res.status}`);
  await t.app.files.completeUpload(actor, { fileId });
  await t.drainJobs();
  return fileId;
}

const defaultOf = async (kind: DocumentTemplate) => (await t.app.documents.downloadTemplate(admin, { kind, versionId: null })).bytes;

async function upload(kind: DocumentTemplate, bytes: Uint8Array, activate = true) {
  return t.app.documents.uploadTemplate(admin, { kind, fileId: await uploadDocx(admin, bytes), activate });
}

const kindView = async (kind: DocumentTemplate) => (await t.app.documents.listTemplates(admin)).find((k) => k.kind === kind)!;

/** The title printed on the Phiếu đăng ký of a fresh nộp, and the template version recorded with it. */
async function registrationFormOfNewSubmission() {
  const s = await f.submitted(sets["Rau củ quả"]!);
  const [v1] = await t.app.dossiers.submissions(s.a, { dossierId: s.dossierId });
  const fileId = v1!.snapshot.documents.registrationForm!;
  const { url } = await t.app.dossiers.downloadSubmissionDocument(s.a, { dossierId: s.dossierId, submissionNumber: 1, document: "registration_form" });
  const text = textOf(new Uint8Array(await (await fetch(url)).arrayBuffer()));
  const { rows } = await db.admin.query<{ metadata: { templateVersionId: string | null } }>(
    "select metadata from platform.audit_log where action = 'file.generated' and target_id = $1",
    [fileId],
  );
  return { text, templateVersionId: rows[0]!.metadata.templateVersionId };
}

describe("Mẫu văn bản có phiên bản (#82)", () => {
  it("lists every loại with no phiên bản, using the mẫu mặc định (story 70)", async () => {
    const kinds = await t.app.documents.listTemplates(admin);
    expect(kinds.map((k) => k.kind)).toContain("recognition_decision_draft");
    expect(kinds.find((k) => k.kind === "ward_report")).toMatchObject({ label: "Báo cáo đánh giá cấp xã", activeVersionId: null, versions: [] });
  });

  it("downloads the mẫu mặc định with its variables in place (story 71)", async () => {
    const { fileName, bytes } = await t.app.documents.downloadTemplate(admin, { kind: "registration_form", versionId: null });
    expect(fileName).toBe("Phiếu đăng ký sản phẩm - mẫu mặc định.docx");
    expect(textOf(bytes)).toContain("{entityName}");
  });

  it("an upload becomes the mẫu đang dùng; văn bản generated afterwards use it and record its id (stories 73, 78, 79)", async () => {
    const before = await registrationFormOfNewSubmission();
    expect(before).toMatchObject({ templateVersionId: null });
    expect(before.text).toContain(TITLE);

    const v1 = await upload("registration_form", edited(await defaultOf("registration_form"), TITLE, "PHIẾU ĐĂNG KÝ (MẪU CỦA SỞ)"));
    expect(v1.n).toBe(1);
    expect(await kindView("registration_form")).toMatchObject({ activeVersionId: v1.versionId, versions: [{ id: v1.versionId, n: 1, active: true }] });
    const after = await registrationFormOfNewSubmission();
    expect(after.text).toContain("PHIẾU ĐĂNG KÝ (MẪU CỦA SỞ)");
    expect(after.templateVersionId).toBe(v1.versionId);

    const download = await t.app.documents.downloadTemplate(admin, { kind: "registration_form", versionId: v1.versionId });
    expect(textOf(download.bytes)).toContain("PHIẾU ĐĂNG KÝ (MẪU CỦA SỞ)");
    expect(download.fileName).toBe("Phiếu đăng ký sản phẩm - phiên bản 1.docx");
  });

  it("an upload kept aside can be tried with the dữ liệu mẫu, then made the mẫu đang dùng; and back to an older one or the default (stories 76, 77)", async () => {
    const base = await defaultOf("ward_report");
    const v1 = await upload("ward_report", edited(base, "{wardName}", "{wardName} (bản 1)"));
    const v2 = await upload("ward_report", edited(base, "{wardName}", "{wardName} (bản 2)"), false);
    expect(v2.n).toBe(2);
    expect((await kindView("ward_report")).activeVersionId).toBe(v1.versionId);

    const preview = await t.app.documents.previewTemplate(admin, { kind: "ward_report", versionId: v2.versionId });
    expect(preview.fileName).toBe("Sinh thử - Báo cáo đánh giá cấp xã - phiên bản 2.docx");
    expect(textOf(preview.bytes)).toContain("Xã Mẫu (bản 2)");
    expect(textOf(preview.bytes)).toContain("Mật ong hoa nhãn Mẫu");
    expect(textOf((await t.app.documents.previewTemplate(admin, { kind: "ward_report", versionId: null })).bytes)).toContain("Có đủ giấy tờ pháp lý");

    await t.app.documents.activateTemplate(admin, { kind: "ward_report", versionId: v2.versionId });
    expect(await kindView("ward_report")).toMatchObject({
      activeVersionId: v2.versionId,
      versions: [
        { n: 2, active: true },
        { n: 1, active: false },
      ],
    });
    await t.app.documents.activateTemplate(admin, { kind: "ward_report", versionId: v1.versionId });
    expect((await kindView("ward_report")).activeVersionId).toBe(v1.versionId);
    await t.app.documents.activateTemplate(admin, { kind: "ward_report", versionId: null });
    expect((await kindView("ward_report")).activeVersionId).toBeNull();
  });

  it("going back to the mẫu mặc định makes new văn bản use it again, recording no version", async () => {
    await t.app.documents.activateTemplate(admin, { kind: "registration_form", versionId: null });
    const doc = await registrationFormOfNewSubmission();
    expect(doc.text).toContain(TITLE);
    expect(doc.templateVersionId).toBeNull();
  });

  it("refuses a version of another loại", async () => {
    const v = await upload("meeting_score_table", await defaultOf("meeting_score_table"), false);
    await expect(t.app.documents.activateTemplate(admin, { kind: "meeting_minutes_draft", versionId: v.versionId })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("audits the upload and the change of mẫu đang dùng", async () => {
    const v = await upload("self_assessment_report", await defaultOf("self_assessment_report"));
    await t.app.documents.activateTemplate(admin, { kind: "self_assessment_report", versionId: null });
    const { rows } = await db.admin.query<{ action: string; target_id: string; metadata: Record<string, unknown>; before: unknown; after: unknown }>(
      "select action, target_id, metadata, before, after from platform.audit_log where target_type = 'document_template' and target_id = 'self_assessment_report' order by occurred_at, id",
    );
    expect(rows.slice(-2)).toEqual([
      expect.objectContaining({
        action: "documents.template.uploaded",
        metadata: expect.objectContaining({ versionId: v.versionId, n: v.n, activated: true }),
      }),
      expect.objectContaining({ action: "documents.template.activated", before: { activeVersionId: v.versionId }, after: { activeVersionId: null } }),
    ]);
  });
});

describe("Mẫu văn bản: mẫu bị từ chối (#82 stories 74, 75)", () => {
  it("names a variable that is not in the list", async () => {
    const bytes = edited(await defaultOf("registration_form"), "{phone}", "{phone} {soFax}");
    await expect(upload("registration_form", bytes)).rejects.toMatchObject({ code: "template_unknown_variable", message: expect.stringContaining("soFax") });
  });

  it("names a missing required variable", async () => {
    const bytes = edited(await defaultOf("registration_form"), "{productName}", "");
    await expect(upload("registration_form", bytes)).rejects.toMatchObject({
      code: "template_missing_variable",
      message: expect.stringContaining("productName"),
    });
  });

  it("refuses a broken tag", async () => {
    const bytes = edited(await defaultOf("registration_form"), "{productName}", "{productName");
    await expect(upload("registration_form", bytes)).rejects.toMatchObject({ code: "template_syntax_error" });
  });

  it("refuses a file that is not a Word document", async () => {
    const zip = new PizZip();
    zip.file("readme.txt", "không phải tệp Word");
    await expect(upload("registration_form", zip.generate({ type: "uint8array" }))).rejects.toMatchObject({ code: "template_not_docx" });
    await expect(
      t.app.files.requestUpload(admin, { purpose: "document_template", fileName: "Mẫu.pdf", contentType: "application/pdf", size: 100 }),
    ).rejects.toMatchObject({ code: "file_type_not_allowed" });
  });

  it("keeps the mẫu đang dùng and its numbering after a refusal", async () => {
    const before = await kindView("meeting_minutes_draft");
    await expect(upload("meeting_minutes_draft", edited(await defaultOf("meeting_minutes_draft"), "{meetingTitle}", ""))).rejects.toMatchObject({
      code: "template_missing_variable",
    });
    expect(await kindView("meeting_minutes_draft")).toEqual(before);
  });
});

describe("Mẫu văn bản mặc định", () => {
  it.each([
    "registration_form",
    "self_assessment_report",
    "ward_report",
    "meeting_score_table",
    "meeting_minutes_draft",
    "recognition_decision_draft",
  ] as const)("the mẫu mặc định of %s passes the checks of an upload", async (kind) => {
    await expect(upload(kind, await defaultOf(kind), false)).resolves.toMatchObject({ versionId: expect.any(String) });
  });
});

describe("Mẫu văn bản: bảng document_template_version", () => {
  it("allows one mẫu đang dùng per loại and refuses changing an uploaded version or deleting it", async () => {
    const v1 = await upload("recognition_decision_draft", await defaultOf("recognition_decision_draft"));
    const v2 = await upload("recognition_decision_draft", await defaultOf("recognition_decision_draft"), false);
    await expect(db.app.query("update platform.document_template_version set active = true where id = $1", [v2.versionId])).rejects.toMatchObject({
      code: "23505",
    });
    await expect(db.app.query("update platform.document_template_version set n = 9 where id = $1", [v1.versionId])).rejects.toMatchObject({
      code: "42501",
    });
    await expect(db.app.query("delete from platform.document_template_version where id = $1", [v1.versionId])).rejects.toMatchObject({ code: "42501" });
  });
});
