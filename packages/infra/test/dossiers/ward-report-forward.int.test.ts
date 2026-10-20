import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import PizZip from "pizzip";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, entityIdOf, fixtures, PRODUCT } from "./fixtures";

let db: TestDatabase;
let t: TestApp;
let wardId: string;
let otherWardId: string;
let f: ReturnType<typeof fixtures>;
let sets: Record<"Rau củ quả" | "Thịt tươi", string>;
const START = new Date("2026-10-19T02:00:00Z");

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n00002,Xã Bình Lợi\n");
  const wards = await t.app.org.listWards();
  wardId = wards.find((w) => w.name === "Xã An Phú")!.id;
  otherWardId = wards.find((w) => w.name === "Xã Bình Lợi")!.id;
  f = fixtures(t, () => wardId);
  t.clock.set(START);
  const version = await f.publishedVersion("26/2026/QĐ-TTg");
  sets = version.sets;
  await f.openRound(version.versionId);
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

/** A hồ sơ submitted into the open round and Tiếp nhận by `officer`. */
async function received(officer: UserActor) {
  const s = await f.submitted(sets["Rau củ quả"]);
  const { version } = await t.app.dossiers.receive(officer, { dossierId: s.dossierId, expectedVersion: s.version });
  return { ...s, version };
}

/** Assesses every item of the Checklist sơ bộ, all Đạt unless `result` says otherwise per index. */
async function assessAll(officer: UserActor, dossierId: string, version: number, result: (n: number) => "pass" | "fail" | "needs_verification" = () => "pass") {
  const { items } = await t.app.dossiers.checklist(officer, { dossierId });
  return (
    await t.app.dossiers.assessChecklist(officer, {
      dossierId,
      expectedVersion: version,
      results: items.map((i, n) => ({ itemCode: i.code, result: result(n), comment: result(n) === "needs_verification" ? "NHAN-XET-NOI-BO" : "" })),
    })
  ).version;
}

describe("L06 XA-07 Báo cáo đánh giá cấp xã (story 64)", () => {
  it("fills the Word report with the Chủ thể, the sản phẩm, the đợt and the Checklist sơ bộ results of the newest Phiên bản nộp, leaving blanks to fill by hand", async () => {
    const officer = await f.staff("ward_officer", wardId);
    const { a, dossierId, version } = await received(officer);
    await assessAll(officer, dossierId, version, (n) => (n === 1 ? "fail" : n === 3 ? "needs_verification" : "pass"));
    const entity = await t.app.entities.getEntity(a, { entityId: entityIdOf(a) });

    const { fileName, bytes } = await t.app.dossiers.generateWardReport(officer, { dossierId });

    expect(fileName).toBe("Báo cáo đánh giá cấp xã - Phiên bản nộp 1.docx");
    const text = docxText(bytes);
    expect(text).toContain("BÁO CÁO ĐÁNH GIÁ CẤP XÃ");
    expect(text).toContain("UBND Xã An Phú");
    expect(text).toContain(`Tên chủ thể: ${entity.name}`);
    expect(text).toContain(`Tên sản phẩm: ${PRODUCT.productName}`);
    expect(text).toContain("Phiên bản nộp số 1, nộp ngày 19/10/2026");
    expect(text).toContain("1 | Tính pháp lý (giấy tờ kinh doanh, an toàn thực phẩm, môi trường) | Đạt |");
    expect(text).toContain("2 | Tính hợp lệ của Phiếu đăng ký và Báo cáo tự đánh giá | Không đạt |");
    expect(text).toContain("4 | Lao động địa phương | Cần xác minh |");
    expect(text).toContain("Đề xuất: Chưa đủ điều kiện chuyển tỉnh");
    for (const blank of ["Thời gian:", "Địa điểm:", "Thành phần tham gia:", "Ý kiến của Chủ thể:"]) expect(text).toContain(blank);
    // The report reaches the Chủ thể once signed, so nhận xét stay out of it (story 35).
    expect(text).not.toContain("NHAN-XET-NOI-BO");
    const [entry] = await t.app.audit.search(await f.admin(), { action: ["dossier.ward_report.generate"], targetId: dossierId });
    expect(entry).toMatchObject({ actorUserId: officer.userId, metadata: { submissionNumber: 1 } });
  });

  it("is generated only by a Cán bộ xã of the hồ sơ's xã, once it is Tiếp nhận", async () => {
    const officer = await f.staff("ward_officer", wardId);
    const s = await f.submitted(sets["Rau củ quả"]);

    await expect(t.app.dossiers.generateWardReport(officer, { dossierId: s.dossierId })).rejects.toMatchObject({ code: "not_received" });
    await expect(t.app.dossiers.generateWardReport(s.a, { dossierId: s.dossierId })).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.dossiers.generateWardReport(await f.staff("ward_officer", otherWardId), { dossierId: s.dossierId })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

/** A received hồ sơ with its Checklist sơ bộ fully assessed. */
async function assessed(officer: UserActor) {
  const r = await received(officer);
  return { ...r, version: await assessAll(officer, r.dossierId, r.version) };
}

/** Uploads a signed PDF as `officer` and attaches it to the hồ sơ. */
async function signAndAttach(officer: UserActor, dossierId: string, version: number, fileName = "BC xã đã ký.pdf") {
  const fileId = await f.uploadPdf(officer, "signed_ward_report", fileName);
  return { fileId, ...(await t.app.dossiers.attachSignedWardReport(officer, { dossierId, expectedVersion: version, fileId })) };
}

describe("L06 XA-07 bản Báo cáo đánh giá cấp xã đã ký (story 65)", () => {
  it("the Cán bộ xã uploads the signed PDF and ties it to the newest Phiên bản nộp", async () => {
    const officer = await f.staff("ward_officer", wardId);
    const { dossierId, version } = await assessed(officer);

    const { fileId, version: v2 } = await signAndAttach(officer, dossierId, version);

    expect(v2).toBe(version + 1);
    expect(await t.app.dossiers.wardReport(officer, { dossierId })).toMatchObject({
      signed: { fileId, fileName: "BC xã đã ký.pdf", submissionNumber: 1, uploadedAt: START, current: true },
      checklistComplete: true,
      forwardingDeadline: new Date("2026-12-15T16:59:59Z"),
      pastForwardingDeadline: false,
    });
    const [entry] = await t.app.audit.search(await f.admin(), { action: ["dossier.ward_report.attach"], targetId: dossierId });
    expect(entry).toMatchObject({ actorUserId: officer.userId, metadata: { fileId, submissionNumber: 1 } });
    const { rowCount } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.ward_report_attached' AND payload->>'dossierId' = $1", [dossierId]);
    expect(rowCount).toBe(1);
  });

  it("accepts only a clean PDF the Cán bộ xã uploaded for this purpose", async () => {
    const officer = await f.staff("ward_officer", wardId);
    const { a, dossierId, version } = await assessed(officer);
    const attach = (fileId: string) => t.app.dossiers.attachSignedWardReport(officer, { dossierId, expectedVersion: version, fileId });

    await expect(
      t.app.files.requestUpload(officer, { purpose: "signed_ward_report", fileName: "BC.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 10 }),
    ).rejects.toMatchObject({ code: "file_type_not_allowed" });
    await expect(attach(await f.uploadPdf(officer, "signed_ward_report", "Đang quét.pdf", { scan: false }))).rejects.toMatchObject({ code: "file_not_ready" });
    await expect(attach(await f.uploadPdf(a, "evidence", "Minh chứng.pdf"))).rejects.toMatchObject({ code: "not_found" });
    const colleague = await f.staff("ward_officer", wardId);
    await expect(attach(await f.uploadPdf(colleague, "signed_ward_report"))).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.files.requestUpload(a, { purpose: "signed_ward_report", fileName: "BC.pdf", contentType: "application/pdf", size: 10 })).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("the Chủ thể sees and downloads the signed report; another Chủ thể does not (story 35)", async () => {
    const officer = await f.staff("ward_officer", wardId);
    const { a, dossierId, version } = await assessed(officer);
    expect((await t.app.dossiers.wardReport(a, { dossierId })).signed).toBeNull();
    await signAndAttach(officer, dossierId, version);

    expect((await t.app.dossiers.wardReport(a, { dossierId })).signed).toMatchObject({ fileName: "BC xã đã ký.pdf", submissionNumber: 1 });
    const { url, fileName } = await t.app.dossiers.downloadSignedWardReport(a, { dossierId });
    expect(fileName).toBe("BC xã đã ký.pdf");
    expect((await fetch(url)).ok).toBe(true);
    const [entry] = await t.app.audit.search(await f.admin(), { action: ["file.download_issued"], actorUserId: a.userId });
    expect(entry).toMatchObject({ metadata: { dossierId, document: "signed_ward_report" } });

    await expect(t.app.dossiers.downloadSignedWardReport(await f.verifiedOwner(), { dossierId })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("L06 XA-07 gửi tỉnh (stories 66, 67)", () => {
  it("is refused without the signed report, with the Checklist sơ bộ not fully assessed, or past Hạn gửi tỉnh", async () => {
    const officer = await f.staff("ward_officer", wardId);
    const r = await received(officer);
    const forward = (expectedVersion: number) => t.app.dossiers.forwardToProvince(officer, { dossierId: r.dossierId, expectedVersion });

    const { version: unsigned } = await t.app.dossiers.assessChecklist(officer, {
      dossierId: r.dossierId,
      expectedVersion: r.version,
      results: [{ itemCode: (await t.app.dossiers.checklist(officer, { dossierId: r.dossierId })).items[0]!.code, result: "pass" }],
    });
    await expect(forward(unsigned)).rejects.toMatchObject({ code: "ward_report_missing" });
    const { version: signed } = await signAndAttach(officer, r.dossierId, unsigned);
    await expect(forward(signed)).rejects.toMatchObject({ code: "checklist_incomplete" });
    const complete = await assessAll(officer, r.dossierId, signed);

    t.clock.set(new Date("2026-12-15T17:00:00Z"));
    await expect(forward(complete)).rejects.toMatchObject({ code: "forwarding_deadline_passed" });
    expect((await t.app.dossiers.wardReport(officer, { dossierId: r.dossierId })).pastForwardingDeadline).toBe(true);
    expect(await t.app.dossiers.get(officer, { dossierId: r.dossierId })).toMatchObject({ state: "submitted_to_ward", version: complete });
  });

  it("moves Đã nộp xã to Đã chuyển tỉnh, records when it first reached the province, and attaches the Phiên bản nộp, checklist and signed report", async () => {
    const officer = await f.staff("ward_officer", wardId);
    const { a, dossierId, version } = await assessed(officer);
    const { fileId, version: v2 } = await signAndAttach(officer, dossierId, version);
    const deadline = new Date("2026-12-15T16:59:59Z");
    t.clock.set(deadline);

    expect(await t.app.dossiers.forwardToProvince(officer, { dossierId, expectedVersion: v2 })).toEqual({ version: v2 + 1 });

    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ state: "forwarded_to_province", firstForwardedAt: deadline, version: v2 + 1 });
    const forwarded = (await t.app.dossiers.timeline(a, { dossierId })).at(-1)!;
    expect(forwarded).toMatchObject({
      action: "dossier.forward",
      fromState: "submitted_to_ward",
      toState: "forwarded_to_province",
      actorUserId: officer.userId,
      metadata: { submissionNumber: 1, wardReportFileId: fileId, checklist: expect.arrayContaining([expect.objectContaining({ result: "pass" })]) },
    });
    const { rowCount } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.forwarded' AND payload->>'dossierId' = $1", [dossierId]);
    expect(rowCount).toBe(1);
    const [entry] = await t.app.audit.search(await f.admin(), { action: ["dossier.forward"], targetId: dossierId });
    expect(entry).toMatchObject({ actorUserId: officer.userId, after: { state: "forwarded_to_province" } });
  });

  it("notifies the Cán bộ Sở and the Chủ thể, in the app and by email", async () => {
    const officer = await f.staff("ward_officer", wardId);
    const province = await f.staff("province_officer");
    const { a, dossierId, version } = await assessed(officer);
    const { version: v2 } = await signAndAttach(officer, dossierId, version);

    await t.app.dossiers.forwardToProvince(officer, { dossierId, expectedVersion: v2 });
    await t.drainJobs();

    expect(await t.app.notifications.list(province)).toContainEqual(expect.objectContaining({ kind: "dossier_forwarded", link: `/so/ho-so/${dossierId}` }));
    expect(await t.app.notifications.list(a)).toContainEqual(expect.objectContaining({ kind: "dossier_forwarded", link: `/chu-the/ho-so/${dossierId}` }));
    expect(t.mailbox.to(province.email).at(-1)!.text).toContain(`/so/ho-so/${dossierId}`);
    expect(t.mailbox.to(a.email).at(-1)!.text).toContain(`/chu-the/ho-so/${dossierId}`);
  });

  it("is done only by a Cán bộ xã of the hồ sơ's xã, and only from Đã nộp xã", async () => {
    const officer = await f.staff("ward_officer", wardId);
    const { a, dossierId, version } = await assessed(officer);
    const { version: v2 } = await signAndAttach(officer, dossierId, version);

    await expect(t.app.dossiers.forwardToProvince(a, { dossierId, expectedVersion: v2 })).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.dossiers.forwardToProvince(await f.staff("ward_officer", otherWardId), { dossierId, expectedVersion: v2 })).rejects.toMatchObject({
      code: "not_found",
    });
    await t.app.dossiers.forwardToProvince(officer, { dossierId, expectedVersion: v2 });
    await expect(t.app.dossiers.forwardToProvince(officer, { dossierId, expectedVersion: v2 + 1 })).rejects.toMatchObject({ code: "invalid_state" });
    await expect(signAndAttach(officer, dossierId, v2 + 1)).rejects.toMatchObject({ code: "invalid_state" });
    await expect(t.app.dossiers.generateWardReport(officer, { dossierId })).rejects.toMatchObject({ code: "invalid_state" });
  });

  it("keeps a signed report once attached: the DB refuses to change or delete it", async () => {
    const officer = await f.staff("ward_officer", wardId);
    const { dossierId, version } = await assessed(officer);
    await signAndAttach(officer, dossierId, version);

    await expect(db.app.query("UPDATE dossier.ward_report SET submission_number = 2 WHERE dossier_id = $1", [dossierId])).rejects.toThrow(/permission denied/);
    await expect(db.app.query("DELETE FROM dossier.ward_report WHERE dossier_id = $1", [dossierId])).rejects.toThrow(/permission denied/);
  });
});

function docxText(bytes: Uint8Array) {
  const xml = new PizZip(bytes).file("word/document.xml")!.asText();
  return xml
    .replace(/<\/w:p>\s*<\/w:tc>/g, " | ")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
