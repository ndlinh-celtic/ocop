import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import PizZip from "pizzip";
import type { FileStore, SubmissionDocument, UserActor } from "@ocop/core";
import { builtInTemplates, docxRenderer } from "../../src/documents/docx";
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

describe("L03 CT-09 Phiếu đăng ký and Báo cáo tự đánh giá generated on nộp (#37, stories 30a, 30b)", () => {
  it("fills the Phiếu đăng ký with the Chủ thể and the sản phẩm, and ties it to Phiên bản nộp 1", async () => {
    const { a, dossierId } = await f.submitted(sets["Rau củ quả"]);
    const entity = await t.app.entities.getEntity(a, { entityId: entityIdOf(a) });

    const [v1] = await t.app.dossiers.submissions(a, { dossierId });
    expect(v1!.snapshot.documents).toEqual({ registrationForm: expect.any(String), selfAssessmentReport: expect.any(String) });

    const text = await documentText(a, dossierId, 1, "registration_form");
    expect(text).toContain(`Tên chủ thể: ${entity.name}`);
    expect(text).toContain(`Người đại diện: ${entity.representativeName}`);
    expect(text).toContain(`Tên sản phẩm: ${PRODUCT.productName}`);
    expect(text).toContain(`Quy trình sản xuất: ${PRODUCT.process}`);
    expect(text).toContain("Kính gửi: UBND Xã An Phú");
    expect(text).toContain("Giấy chứng nhận đăng ký doanh nghiệp, hợp tác xã hoặc hộ kinh doanh, cấp ngày 01/01/2025");
    expect(text).toContain("Phiên bản nộp số 1, nộp ngày 19/10/2026.");
  });

  it("fills the Báo cáo tự đánh giá with the tự chấm, giải trình and minh chứng of every Tiêu chí, and the total", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    const evidenceId = await f.uploadPdf(a, "evidence", "Phiếu kiểm nghiệm.pdf");
    await t.app.dossiers.addEvidenceFile(a, { dossierId, expectedVersion: 1, fileId: evidenceId });
    let version = await f.completeDraft(a, dossierId);
    const { set } = await t.app.dossiers.selfAssessment(a, { dossierId });
    const criterion = set.parts[0]!.sections[0]!.items[0]!;
    if (criterion.kind !== "criterion") throw new Error("expected a Tiêu chí");
    const best = [...criterion.levels].sort((x, y) => y.points - x.points)[0]!;
    ({ version } = await t.app.dossiers.selfScore(a, { dossierId, expectedVersion: version, criterionId: criterion.id, levelId: best.id }));
    ({ version } = await t.app.dossiers.linkEvidence(a, { dossierId, expectedVersion: version, fileId: evidenceId, criterionIds: [criterion.id] }));
    ({ version } = await t.app.dossiers.explainCriterion(a, {
      dossierId,
      expectedVersion: version,
      criterionId: criterion.id,
      explanation: "Đạt chỉ tiêu vi sinh",
    }));

    await t.app.dossiers.submit(a, { dossierId, expectedVersion: version });

    const text = await documentText(a, dossierId, 1, "self_assessment_report");
    expect(text).toContain(`Tên sản phẩm: ${PRODUCT.productName}`);
    expect(text).toContain("Bộ tiêu chí: ");
    expect(text).toContain("Rau củ quả");
    expect(text).toContain("Căn cứ: 26/2026/QĐ-TTg");
    expect(text).toContain("A | 1.1 | Tiêu chí thử | 100 | Đạt chỉ tiêu vi sinh | Phiếu kiểm nghiệm.pdf |");
    expect(text).toContain("Tổng điểm tự chấm: 100");
    expect(text).toContain("Hạng sao tự đánh giá (chỉ để tham khảo): 5 sao");
  });

  it("generates within the nộp: when a văn bản cannot be rendered, the hồ sơ is not submitted", async () => {
    const failing = createTestApp(db, {
      totpRequired: false,
      clock: t.clock,
      documents: { ...docxRenderer(), render: async () => Promise.reject(new Error("template broken")) },
    });
    try {
      const a = await f.verifiedOwner();
      const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
      const expectedVersion = await f.completeDraft(a, dossierId);

      await expect(failing.app.dossiers.submit(a, { dossierId, expectedVersion })).rejects.toThrow(/template broken/);

      expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ state: "draft", version: expectedVersion, latestSubmission: null });
      expect(await t.app.dossiers.submissions(a, { dossierId })).toEqual([]);
    } finally {
      await failing.stop();
    }
  });

  it("leaves no văn bản behind in storage when the nộp fails after one was stored", async () => {
    const stored: string[] = [];
    let real: FileStore | undefined;
    const failing = createTestApp(db, {
      totpRequired: false,
      clock: t.clock,
      files: (store) => {
        real = store;
        return {
          ...store,
          async put(key, body, contentType) {
            if (stored.length === 1) throw new Error("storage unavailable");
            await store.put(key, body, contentType);
            stored.push(key);
          },
        };
      },
    });
    try {
      const a = await f.verifiedOwner();
      const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
      const expectedVersion = await f.completeDraft(a, dossierId);

      await expect(failing.app.dossiers.submit(a, { dossierId, expectedVersion })).rejects.toThrow(/storage unavailable/);

      expect(stored).toHaveLength(1);
      expect(await real!.head(stored[0]!)).toBeNull();
      expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ state: "draft", latestSubmission: null });
    } finally {
      await failing.stop();
    }
  });

  it("keeps the văn bản of an earlier Phiên bản nộp unchanged when the template changes", async () => {
    const before = await f.submitted(sets["Rau củ quả"]);
    const original = await documentBytes(before.a, before.dossierId, 1, "registration_form");
    const revised = createTestApp(db, { totpRequired: false, clock: t.clock, documents: docxRenderer(withTitle("PHIẾU ĐĂNG KÝ (MẪU SỬA ĐỔI)")) });
    try {
      const a = await f.verifiedOwner();
      const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
      await revised.app.dossiers.submit(a, { dossierId, expectedVersion: await f.completeDraft(a, dossierId) });

      expect(await documentText(a, dossierId, 1, "registration_form")).toContain("PHIẾU ĐĂNG KÝ (MẪU SỬA ĐỔI)");
      expect(await documentBytes(before.a, before.dossierId, 1, "registration_form")).toEqual(original);
      expect(docxText(original)).not.toContain("MẪU SỬA ĐỔI");
    } finally {
      await revised.stop();
    }
  });
});

describe("Who may download the văn bản of a Phiên bản nộp (#37)", () => {
  it("the Chủ thể and the Cán bộ xã of the xã it was submitted to; any other hồ sơ is not found", async () => {
    const { a, dossierId } = await f.submitted(sets["Rau củ quả"]);
    const input = { dossierId, submissionNumber: 1, document: "registration_form" } as const;

    const officer = await f.staff("ward_officer", wardId);
    expect(await documentText(officer, dossierId, 1, "self_assessment_report")).toContain("BÁO CÁO TỰ ĐÁNH GIÁ");
    const [audit] = await t.app.audit.search(await f.admin(), { action: ["file.download_issued"], actorUserId: officer.userId });
    expect(audit).toMatchObject({ targetType: "file", metadata: { dossierId, submissionNumber: 1, document: "self_assessment_report" } });

    await expect(t.app.dossiers.downloadSubmissionDocument(await f.verifiedOwner(), input)).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.dossiers.downloadSubmissionDocument(await f.staff("ward_officer", otherWardId), input)).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.dossiers.downloadSubmissionDocument(await f.staff("admin"), input)).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.dossiers.downloadSubmissionDocument(a, { ...input, submissionNumber: 2 })).rejects.toMatchObject({ code: "not_found" });
  });

  it("a Nháp has no văn bản, and a generated văn bản cannot be reached through the uploader's own download", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    await expect(t.app.dossiers.downloadSubmissionDocument(a, { dossierId, submissionNumber: 1, document: "registration_form" })).rejects.toMatchObject({
      code: "not_found",
    });

    const submitted = await f.submitted(sets["Rau củ quả"]);
    const [v1] = await t.app.dossiers.submissions(submitted.a, { dossierId: submitted.dossierId });
    await expect(t.app.files.requestDownload(submitted.a, { fileId: v1!.snapshot.documents.registrationForm! })).rejects.toMatchObject({ code: "not_found" });
  });
});

/** The built-in templates, with the Phiếu đăng ký's title replaced: a revised template. */
function withTitle(title: string) {
  const templates = builtInTemplates();
  const zip = new PizZip(templates.registration_form);
  const xml = zip.file("word/document.xml")!.asText();
  zip.file("word/document.xml", xml.replace("PHIẾU ĐĂNG KÝ SẢN PHẨM THAM GIA ĐÁNH GIÁ, PHÂN HẠNG SẢN PHẨM OCOP", title));
  return { ...templates, registration_form: zip.generate({ type: "uint8array" }) };
}

async function documentBytes(actor: UserActor, dossierId: string, submissionNumber: number, document: SubmissionDocument) {
  const { url, fileName } = await t.app.dossiers.downloadSubmissionDocument(actor, { dossierId, submissionNumber, document });
  expect(fileName).toMatch(/ - Phiên bản nộp \d+\.docx$/);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Downloads one generated document through the use case and returns the text of its body, paragraph per line. */
async function documentText(actor: UserActor, dossierId: string, submissionNumber: number, document: SubmissionDocument) {
  return docxText(await documentBytes(actor, dossierId, submissionNumber, document));
}

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
