import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, entityIdOf, fixtures, PRODUCT } from "./fixtures";

let db: TestDatabase;
let t: TestApp;
let wardId: string;
let f: ReturnType<typeof fixtures>;
/** The Phiên bản tiêu chí of the đợt Đang nhận nộp, and its Bộ tiêu chí. */
let sets: Record<"Rau củ quả" | "Thịt tươi", string>;
let roundId: string;
const START = new Date("2026-10-19T02:00:00Z");

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n00002,Xã Bình Lợi\n");
  wardId = (await t.app.org.listWards()).find((w) => w.name === "Xã An Phú")!.id;
  f = fixtures(t, () => wardId);
  t.clock.set(START);
  const version = await f.publishedVersion("26/2026/QĐ-TTg");
  sets = version.sets;
  roundId = await f.openRound(version.versionId);
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("L03 CT-09 nộp hồ sơ (stories 28 to 32)", () => {
  it("submits a complete Nháp into the đợt Đang nhận nộp: Đã nộp xã, in the Chủ thể's xã, with Phiên bản nộp 1", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    const expectedVersion = await f.completeDraft(a, dossierId);

    const { version, submissionNumber } = await t.app.dossiers.submit(a, { dossierId, expectedVersion });

    expect(submissionNumber).toBe(1);
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({
      state: "submitted_to_ward",
      wardId,
      roundId,
      version,
      productName: PRODUCT.productName,
      latestSubmission: { number: 1, submittedAt: START },
      flags: [],
    });
  });

  it("refuses a blank Nháp listing every reason: thông tin sản phẩm missing, Tiêu chí not tự chấm (story 29)", async () => {
    const a = await f.verifiedOwner();
    const { dossierId, version } = await blankDraft(a);

    const err = await t.app.dossiers.submit(a, { dossierId, expectedVersion: version }).catch((e: unknown) => e);

    expect(err).toMatchObject({ code: "submission_blocked" });
    expect(blockersOf(err)).toEqual([
      expect.objectContaining({ code: "missing_product_field", field: "productName" }),
      expect.objectContaining({ code: "criterion_unscored", criterionCode: "1.1" }),
    ]);
    expect((await t.app.dossiers.submissionCheck(a, { dossierId })).blockers).toEqual(blockersOf(err));
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ state: "draft", wardId: null, roundId: null, version, latestSubmission: null });
    expect(await t.app.dossiers.submissions(a, { dossierId })).toEqual([]);
  });

  it("refuses when no đợt is Đang nhận nộp, its Hạn nộp xã having passed (story 29)", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    const expectedVersion = await f.completeDraft(a, dossierId);
    t.clock.set(new Date("2026-11-30T17:00:00Z")); // 01/12/2026 00:00 giờ Việt Nam

    expect(codesOf(await t.app.dossiers.submit(a, { dossierId, expectedVersion }).catch((e: unknown) => e))).toEqual(["no_open_round"]);
  });

  it("refuses a hồ sơ on another Phiên bản tiêu chí than the đợt's, pointing to a new hồ sơ (stories 27, 29)", async () => {
    // Past Hạn nộp xã no đợt applies, so a new hồ sơ takes the newest published version.
    t.clock.set(new Date("2026-12-01T02:00:00Z"));
    const newer = await f.publishedVersion("99/2026/QĐ-UBND");
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: newer.sets["Rau củ quả"] });
    const expectedVersion = await f.completeDraft(a, dossierId);
    t.clock.set(START);

    const err = await t.app.dossiers.submit(a, { dossierId, expectedVersion }).catch((e: unknown) => e);
    expect(blockersOf(err)).toEqual([expect.objectContaining({ code: "round_version_mismatch", roundName: expect.any(String) })]);
    const { dossierId: copyId } = await t.app.dossiers.copy(a, { dossierId, criteriaSetId: sets["Rau củ quả"] });
    await t.app.dossiers.submit(a, { dossierId: copyId, expectedVersion: await f.completeDraft(a, copyId) });
    expect(await t.app.dossiers.get(a, { dossierId: copyId })).toMatchObject({ state: "submitted_to_ward" });
  });

  it("refuses a Chủ thể no longer Đã xác thực, and one whose giấy tờ bắt buộc has expired (story 29)", async () => {
    const scanning = await f.verifiedOwner();
    const pending = await draftReady(scanning);
    const [gpkd] = (await t.app.entities.getLegalStanding(scanning, { entityId: entityIdOf(scanning) })).documents;
    await t.app.entities.addLegalDocument(scanning, {
      entityId: entityIdOf(scanning),
      typeCode: "business_registration",
      fileId: await f.uploadPdf(scanning, "legal_document", "GPKD mới.pdf", { scan: false }),
      issuedOn: "2026-10-01",
      validUntil: null,
      replacesId: gpkd!.id,
    });
    expect(codesOf(await t.app.dossiers.submit(scanning, pending).catch((e: unknown) => e))).toEqual(["entity_not_verified"]);

    const expiring = await ownerWithGpkdUntil("2026-10-25");
    const ready = await draftReady(expiring);
    t.clock.set(new Date("2026-10-25T17:00:00Z")); // 26/10/2026 giờ Việt Nam
    const err = await t.app.dossiers.submit(expiring, ready).catch((e: unknown) => e);
    expect(blockersOf(err)).toEqual([expect.objectContaining({ code: "legal_document_expired", typeCode: "business_registration", validUntil: "2026-10-25" })]);
  });

  it("submits with Tiêu chí that have no minh chứng and only 0-point Mức điểm (story 30)", async () => {
    const { a, dossierId } = await f.submitted(sets["Thịt tươi"]);
    const [v1] = await t.app.dossiers.submissions(a, { dossierId });
    expect(v1!.snapshot.criteria).toEqual([expect.objectContaining({ code: "1.1", points: 0, evidenceFileIds: [] })]);
    expect(v1!.snapshot.selfScore).toEqual({ total: 0, star: 1 });
  });

  it("freezes the bản làm việc and the Chủ thể into Phiên bản nộp 1 (story 31)", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    const evidenceId = await f.uploadPdf(a, "evidence", "Kiểm nghiệm.pdf");
    await t.app.dossiers.addEvidenceFile(a, { dossierId, expectedVersion: 1, fileId: evidenceId });
    let version = await f.completeDraft(a, dossierId);
    const { criteria } = await t.app.dossiers.selfAssessment(a, { dossierId });
    const criterionId = criteria[0]!.criterionId;
    ({ version } = await t.app.dossiers.linkEvidence(a, { dossierId, expectedVersion: version, fileId: evidenceId, criterionIds: [criterionId] }));
    ({ version } = await t.app.dossiers.explainCriterion(a, { dossierId, expectedVersion: version, criterionId, explanation: "Có phiếu kiểm nghiệm" }));
    const [gpkd] = (await t.app.entities.getLegalStanding(a, { entityId: entityIdOf(a) })).documents;

    await t.app.dossiers.submit(a, { dossierId, expectedVersion: version });

    const [v1] = await t.app.dossiers.submissions(a, { dossierId });
    expect(v1).toMatchObject({ number: 1, roundId, wardId, submittedAt: START, submittedBy: a.userId });
    expect(v1!.snapshot).toEqual({
      product: PRODUCT,
      criteriaSet: { id: sets["Rau củ quả"], code: expect.any(String), name: "Rau củ quả" },
      criteriaVersion: { id: expect.any(String), legalBasis: "26/2026/QĐ-TTg" },
      entity: expect.objectContaining({ id: entityIdOf(a), kind: "enterprise", name: expect.stringMatching(/^Chủ thể /), wardId }),
      legalDocuments: [
        expect.objectContaining({ id: gpkd!.id, typeCode: "business_registration", issuedOn: "2025-01-01", validUntil: null, fileId: gpkd!.fileId, fileName: "GPKD.pdf" }),
      ],
      evidence: [{ fileId: evidenceId, fileName: "Kiểm nghiệm.pdf" }],
      criteria: [
        {
          criterionId,
          code: "1.1",
          name: "Tiêu chí thử",
          partCode: "A",
          levelId: criteria[0]!.levelId,
          points: 0,
          explanation: "Có phiếu kiểm nghiệm",
          evidenceFileIds: [evidenceId],
        },
      ],
      selfScore: { total: 0, star: 1 },
      documents: { registrationForm: null, selfAssessmentReport: null },
    });
  });

  it("keeps the Chủ thể of Phiên bản nộp and the xã of the hồ sơ when the Chủ thể later renames or moves (stories 10, 31)", async () => {
    const { a, dossierId } = await f.submitted(sets["Rau củ quả"]);
    const before = await t.app.entities.getEntity(a,{ entityId: entityIdOf(a) });
    const otherWard = (await t.app.org.listWards()).find((w) => w.name === "Xã Bình Lợi")!.id;

    await t.app.entities.updateEntity(a, {
      entityId: entityIdOf(a),
      name: "Tên mới",
      address: before.address,
      representativeName: before.representativeName,
      phone: before.phone,
      wardId: otherWard,
    });

    expect((await t.app.dossiers.submissions(a, { dossierId }))[0]!.snapshot.entity).toMatchObject({ name: before.name, wardId });
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ wardId });
  });

  it("leaves the bản làm việc unchangeable once submitted (story 32)", async () => {
    const { a, dossierId, version } = await f.submitted(sets["Rau củ quả"]);
    const { criteria } = await t.app.dossiers.selfAssessment(a, { dossierId });
    const invalid = { code: "invalid_state" };
    const edit = { dossierId, expectedVersion: version };

    await expect(t.app.dossiers.updateProduct(a, { ...edit, productName: "Sửa sau khi nộp" })).rejects.toMatchObject(invalid);
    await expect(t.app.dossiers.addEvidenceFile(a, { ...edit, fileId: await f.uploadPdf(a, "evidence") })).rejects.toMatchObject(invalid);
    await expect(t.app.dossiers.selfScore(a, { ...edit, criterionId: criteria[0]!.criterionId, levelId: null })).rejects.toMatchObject(invalid);
    await expect(t.app.dossiers.explainCriterion(a, { ...edit, criterionId: criteria[0]!.criterionId, explanation: "x" })).rejects.toMatchObject(invalid);
    await expect(t.app.dossiers.delete(a, edit)).rejects.toMatchObject(invalid);
    await expect(t.app.dossiers.submit(a, edit)).rejects.toMatchObject(invalid);
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ productName: PRODUCT.productName, version, evidence: [] });
  });

  it("refuses a nộp from a stale version, another Chủ thể's as not found, and a Cán bộ xã's as not found too: a Nháp belongs to no xã", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    const expectedVersion = await f.completeDraft(a, dossierId);

    await expect(t.app.dossiers.submit(a, { dossierId, expectedVersion: expectedVersion - 1 })).rejects.toMatchObject({ code: "version_conflict" });
    await expect(t.app.dossiers.submit(await f.verifiedOwner(), { dossierId, expectedVersion })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.dossiers.submissions(await f.verifiedOwner(), { dossierId })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.dossiers.submit(await f.staff("ward_officer", wardId), { dossierId, expectedVersion })).rejects.toMatchObject({ code: "not_found" });
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ state: "draft", version: expectedVersion });
  });

  it("records the nộp on the timeline, in the audit log and in the outbox (stories 34, 84, 85)", async () => {
    const { a, dossierId, version } = await f.submitted(sets["Rau củ quả"]);

    const timeline = await t.app.dossiers.timeline(a, { dossierId });
    expect(timeline.map((e) => [e.action, e.fromState, e.toState])).toEqual([
      ["dossier.create", null, "draft"],
      ["dossier.submit", "draft", "submitted_to_ward"],
    ]);
    expect(timeline[1]).toMatchObject({ actorUserId: a.userId, actorRole: "entity_owner", occurredAt: START, metadata: { submissionNumber: 1, roundId, wardId } });
    const [audit] = await t.app.audit.search(await f.admin(), { action: ["dossier.submit"], targetId: dossierId });
    expect(audit).toMatchObject({ actorUserId: a.userId, after: { state: "submitted_to_ward", version } });
    const { rows } = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'dossier.submitted' AND payload->>'dossierId' = $1", [dossierId]);
    expect(rows).toEqual([{ payload: { dossierId, entityId: entityIdOf(a), from: "draft", to: "submitted_to_ward" } }]);
  });
});

describe("L03 giấy tờ hết hạn sau khi nộp (story 45)", () => {
  it("keeps the state of the hồ sơ and flags it once a giấy tờ of its Phiên bản nộp expires", async () => {
    const a = await ownerWithGpkdUntil("2026-10-25");
    const { dossierId } = await draftReady(a).then(async (ready) => (await t.app.dossiers.submit(a, ready), ready));
    const { version } = await t.app.dossiers.get(a, { dossierId });

    t.clock.set(new Date("2026-10-25T16:59:59Z")); // the last second of 25/10/2026 giờ Việt Nam
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ state: "submitted_to_ward", flags: [] });

    t.clock.advance(1_000);
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({
      state: "submitted_to_ward",
      version,
      flags: [{ kind: "legal_document_expired", typeCode: "business_registration", validUntil: "2026-10-25" }],
    });
  });
});

describe("L03 CT-10 rút hồ sơ (story 33)", () => {
  it("rút a hồ sơ Đã nộp xã with a reason: Đã rút, on the timeline with the reason", async () => {
    const { a, dossierId, version } = await f.submitted(sets["Rau củ quả"]);

    const after = await t.app.dossiers.withdraw(a, { dossierId, expectedVersion: version, reason: "  Nộp nhầm sản phẩm  " });

    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ state: "withdrawn", version: after.version, latestSubmission: { number: 1 } });
    expect((await t.app.dossiers.timeline(a, { dossierId })).at(-1)).toMatchObject({
      action: "dossier.withdraw",
      fromState: "submitted_to_ward",
      toState: "withdrawn",
      reason: "Nộp nhầm sản phẩm",
    });
    const [audit] = await t.app.audit.search(await f.admin(), { action: ["dossier.withdraw"], targetId: dossierId });
    expect(audit).toMatchObject({ metadata: { reason: "Nộp nhầm sản phẩm" } });
    const { rows } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.withdrawn' AND payload->>'dossierId' = $1", [dossierId]);
    expect(rows).toHaveLength(1);
    await expect(t.app.dossiers.withdraw(a, { dossierId, expectedVersion: after.version, reason: "Lần hai" })).rejects.toMatchObject({ code: "invalid_state" });
  });

  it("requires a reason, and refuses a Nháp, a stale version and another Chủ thể", async () => {
    const { a, dossierId, version } = await f.submitted(sets["Rau củ quả"]);
    await expect(t.app.dossiers.withdraw(a, { dossierId, expectedVersion: version, reason: "   " })).rejects.toMatchObject({ code: "reason_required" });
    await expect(t.app.dossiers.withdraw(a, { dossierId, expectedVersion: version - 1, reason: "x" })).rejects.toMatchObject({ code: "version_conflict" });
    await expect(t.app.dossiers.withdraw(await f.verifiedOwner(), { dossierId, expectedVersion: version, reason: "x" })).rejects.toMatchObject({ code: "not_found" });
    const draft = await blankDraft(a);
    await expect(t.app.dossiers.withdraw(a, { dossierId: draft.dossierId, expectedVersion: draft.version, reason: "x" })).rejects.toMatchObject({ code: "invalid_state" });
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ state: "submitted_to_ward", version });
  });

  it("refuses once the xã has Tiếp nhận the hồ sơ (L05 XA-02)", async () => {
    const { a, dossierId, version } = await f.submitted(sets["Rau củ quả"]);
    const officer = await f.staff("ward_officer", wardId);
    const received = await t.app.dossiers.receive(officer, { dossierId, expectedVersion: version });

    await expect(t.app.dossiers.withdraw(a, { dossierId, expectedVersion: received.version, reason: "Muộn" })).rejects.toMatchObject({ code: "already_received" });
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ state: "submitted_to_ward" });
  });
});

describe("Phiên bản nộp in the database (three-layer protection)", () => {
  it("the app user can neither change nor delete a Phiên bản nộp, and the trigger refuses even the owner", async () => {
    const { dossierId } = await f.submitted(sets["Rau củ quả"]);
    const ofDossier = "submission_id IN (SELECT id FROM dossier.submission WHERE dossier_id = $1)";
    for (const statement of [
      "UPDATE dossier.submission SET snapshot = '{}' WHERE dossier_id = $1",
      "DELETE FROM dossier.submission WHERE dossier_id = $1",
      `UPDATE dossier.submission_file SET role = 'evidence' WHERE ${ofDossier}`,
      `DELETE FROM dossier.submission_file WHERE ${ofDossier}`,
    ]) {
      await expect(db.app.query(statement, [dossierId])).rejects.toThrow(/permission denied/);
      await expect(db.admin.query(statement, [dossierId])).rejects.toThrow(/immutable/);
    }
    await expect(db.app.query("ALTER TABLE dossier.submission DISABLE TRIGGER submission_immutable")).rejects.toThrow(/must be owner/);
    await expect(db.admin.query("TRUNCATE dossier.submission_file")).rejects.toThrow(/immutable/);
  });

  it("a file a Phiên bản nộp refers to cannot be deleted", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    const fileId = await f.uploadPdf(a, "evidence", "Giữ lại.pdf");
    await t.app.dossiers.addEvidenceFile(a, { dossierId, expectedVersion: 1, fileId });
    await t.app.dossiers.submit(a, { dossierId, expectedVersion: await f.completeDraft(a, dossierId) });

    await expect(db.app.query("DELETE FROM platform.file WHERE id = $1", [fileId])).rejects.toThrow(/permission denied/);
    await expect(db.admin.query("DELETE FROM platform.file WHERE id = $1", [fileId])).rejects.toThrow(/foreign key/);
  });
});

/** A new Nháp on "Rau củ quả" with nothing filled in. */
async function blankDraft(a: UserActor) {
  const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
  return { dossierId, version: 1 };
}

/** A complete Nháp of the Chủ thể, as the input of submit. */
async function draftReady(a: UserActor) {
  const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
  return { dossierId, expectedVersion: await f.completeDraft(a, dossierId) };
}

/** A Chủ thể Đã xác thực by a GPKD valid until the given VN day. */
async function ownerWithGpkdUntil(validUntil: string) {
  const a = await f.owner();
  const fileId = await f.uploadPdf(a, "legal_document", "GPKD có hạn.pdf");
  await t.app.entities.addLegalDocument(a, { entityId: entityIdOf(a), typeCode: "business_registration", fileId, issuedOn: "2025-01-01", validUntil });
  return a;
}

const blockersOf = (err: unknown) => (err as { blockers?: { code: string }[] }).blockers ?? [];
const codesOf = (err: unknown) => blockersOf(err).map((b) => b.code);
