import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { onBehalfOf, type UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, entityIdOf, fixtures } from "./fixtures";

let db: TestDatabase;
let t: TestApp;
let wardX: string;
let wardY: string;
let f: ReturnType<typeof fixtures>;
let sets: Record<"Rau củ quả" | "Thịt tươi", string>;
let officerX: UserActor;
const START = new Date("2026-10-19T02:00:00Z");

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n00002,Xã Bình Lợi\n");
  const wards = await t.app.org.listWards();
  wardX = wards.find((w) => w.name === "Xã An Phú")!.id;
  wardY = wards.find((w) => w.name === "Xã Bình Lợi")!.id;
  f = fixtures(t, () => wardX);
  t.clock.set(START);
  const version = await f.publishedVersion("26/2026/QĐ-TTg");
  sets = version.sets;
  await f.openRound(version.versionId);
  officerX = await f.staff("ward_officer", wardX);
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("L01 Nhập hộ: Cán bộ xã works on a hồ sơ for a Chủ thể đăng ký ở xã mình (story 72)", () => {
  it("creates a Nháp for the Chủ thể, audited as the officer on behalf of the Chủ thể (story 73)", async () => {
    const owner = await f.verifiedOwner();
    const entityId = entityIdOf(owner);

    const { dossierId } = await t.app.dossiers.create(onBehalfOf(officerX, entityId), { criteriaSetId: sets["Rau củ quả"] });

    expect(await t.app.dossiers.get(owner, { dossierId })).toMatchObject({ entityId, state: "draft", createdBy: officerX.userId });
    const [audit] = await t.app.audit.search(await f.admin(), { action: ["dossier.create_on_behalf"], targetId: dossierId });
    expect(audit).toMatchObject({ actorUserId: officerX.userId, actorRole: "ward_officer", metadata: { onBehalfOf: entityId } });
  });

  it("uploads minh chứng, ties it, tự chấm thử and nộp for the Chủ thể; the Chủ thể's timeline shows each step the officer did (story 74)", async () => {
    const owner = await f.verifiedOwner();
    const entityId = entityIdOf(owner);
    const officer = onBehalfOf(officerX, entityId);
    const { dossierId } = await t.app.dossiers.create(officer, { criteriaSetId: sets["Rau củ quả"] });
    const fileId = await f.uploadPdf(officer, "evidence", "Phiếu kiểm nghiệm.pdf");
    let { version } = await t.app.dossiers.addEvidenceFile(officer, { dossierId, expectedVersion: 1, fileId });
    const { criteria } = await t.app.dossiers.selfAssessment(officer, { dossierId });
    ({ version } = await t.app.dossiers.linkEvidence(officer, { dossierId, expectedVersion: version, fileId, criterionIds: [criteria[0]!.criterionId] }));
    ({ version } = await t.app.dossiers.explainCriterion(officer, { dossierId, expectedVersion: version, criterionId: criteria[0]!.criterionId, explanation: "Có phiếu" }));
    version = await f.completeDraft(officer, dossierId);

    await t.app.dossiers.submit(officer, { dossierId, expectedVersion: version });

    expect(await t.app.dossiers.get(owner, { dossierId })).toMatchObject({ state: "submitted_to_ward", wardId: wardX });
    expect((await t.app.dossiers.selfAssessment(owner, { dossierId })).criteria[0]).toMatchObject({ explanation: "Có phiếu", evidence: [{ fileId }] });
    const timeline = await t.app.dossiers.timeline(owner, { dossierId });
    expect(timeline.map((e) => e.action)).toEqual([
      "dossier.create_on_behalf",
      "dossier.evidence.add_on_behalf",
      "dossier.evidence.link_on_behalf",
      "dossier.explain_on_behalf",
      "dossier.edit_on_behalf",
      "dossier.self_score_on_behalf",
      "dossier.submit_on_behalf",
    ]);
    for (const e of timeline) expect(e).toMatchObject({ actorUserId: officerX.userId, actorRole: "ward_officer", metadata: { onBehalfOf: entityId } });
    const [submitted] = await t.app.audit.search(await f.admin(), { action: ["dossier.submit_on_behalf"], targetId: dossierId });
    expect(submitted).toMatchObject({ actorUserId: officerX.userId, actorRole: "ward_officer", metadata: { onBehalfOf: entityId } });
  });

  it("refuses to nộp for the Chủ thể on the same conditions as when it nộp itself", async () => {
    const owner = await f.verifiedOwner();
    const officer = onBehalfOf(officerX, entityIdOf(owner));
    const { dossierId } = await t.app.dossiers.create(officer, { criteriaSetId: sets["Rau củ quả"] });

    await expect(t.app.dossiers.submit(officer, { dossierId, expectedVersion: 1 })).rejects.toMatchObject({
      code: "submission_blocked",
      blockers: expect.arrayContaining([expect.objectContaining({ code: "missing_product_field" }), expect.objectContaining({ code: "criterion_unscored" })]),
    });
    expect((await t.app.dossiers.submissionCheck(officer, { dossierId })).blockers.map((b) => b.code)).toContain("missing_product_field");
    expect(await t.app.dossiers.get(owner, { dossierId })).toMatchObject({ state: "draft" });
  });
});

describe("L01 Nhập hộ while the xã asks for more (L04 CT-11)", () => {
  it("answers the yêu cầu bổ sung and nộp lại for the Chủ thể, into Phiên bản nộp 2", async () => {
    const s = await f.submitted(sets["Rau củ quả"]);
    const officer = onBehalfOf(officerX, entityIdOf(s.a));
    let { version } = await t.app.dossiers.receive(officerX, { dossierId: s.dossierId, expectedVersion: s.version });
    ({ version } = await t.app.dossiers.requestSupplement(officerX, {
      dossierId: s.dossierId,
      expectedVersion: version,
      deadline: "2026-10-31",
      items: [{ content: "Bổ sung phiếu kiểm nghiệm" }],
    }));
    const [request] = await t.app.dossiers.supplementRequests(officer, { dossierId: s.dossierId });

    ({ version } = await t.app.dossiers.respondSupplementItem(officer, { dossierId: s.dossierId, expectedVersion: version, itemId: request!.items[0]!.id, response: "Đã bổ sung" }));
    const { submissionNumber } = await t.app.dossiers.submit(officer, { dossierId: s.dossierId, expectedVersion: version });

    expect(submissionNumber).toBe(2);
    const [answered] = await t.app.dossiers.supplementRequests(s.a, { dossierId: s.dossierId });
    expect(answered!.items[0]).toMatchObject({ response: "Đã bổ sung", respondedBy: officerX.userId });
    expect((await t.app.dossiers.timeline(s.a, { dossierId: s.dossierId })).slice(-2)).toMatchObject([
      { action: "dossier.supplement.respond_on_behalf", metadata: { onBehalfOf: entityIdOf(s.a) } },
      { action: "dossier.resubmit_on_behalf", toState: "submitted_to_ward", metadata: { onBehalfOf: entityIdOf(s.a) } },
    ]);
  });
});

describe("L01 Nhập hộ only for a Chủ thể đăng ký ở xã mình (story 75)", () => {
  it("refuses a Chủ thể of another xã, even one whose hồ sơ was moved to the officer's xã by Chuyển xã", async () => {
    const officerY = await f.staff("ward_officer", wardY);
    const s = await f.submitted(sets["Rau củ quả"], wardY);
    const entityId = entityIdOf(s.a);
    const { dossierId: draftId } = await t.app.dossiers.create(s.a, { criteriaSetId: sets["Thịt tươi"] });
    const received = await t.app.dossiers.receive(officerY, { dossierId: s.dossierId, expectedVersion: s.version });
    await t.app.dossiers.transferWard(officerY, { dossierId: s.dossierId, expectedVersion: received.version, wardId: wardX, reason: "Sai địa bàn" });
    // officerX now sees the moved hồ sơ as the xã handling it, but may not act for its Chủ thể.
    expect(await t.app.dossiers.get(officerX, { dossierId: s.dossierId })).toMatchObject({ wardId: wardX });
    const officer = onBehalfOf(officerX, entityId);

    await expect(t.app.dossiers.create(officer, { criteriaSetId: sets["Rau củ quả"] })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.dossiers.get(officer, { dossierId: s.dossierId })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.dossiers.updateProduct(officer, { dossierId: draftId, expectedVersion: 1, productName: "Khác" })).rejects.toMatchObject({ code: "not_found" });
    expect(await t.app.dossiers.list(officer)).toEqual([]);
    expect(await t.app.dossiers.get(s.a, { dossierId: draftId })).toMatchObject({ productName: "", version: 1 });
  });

  it("stops once the Chủ thể changes its xã đăng ký to another xã", async () => {
    const owner = await f.verifiedOwner();
    const entityId = entityIdOf(owner);
    const { dossierId } = await t.app.dossiers.create(onBehalfOf(officerX, entityId), { criteriaSetId: sets["Rau củ quả"] });
    const entity = await t.app.entities.getEntity(owner, { entityId });
    await t.app.entities.updateEntity(owner, { entityId, name: entity.name, address: entity.address, representativeName: entity.representativeName, phone: entity.phone, wardId: wardY });

    await expect(t.app.dossiers.get(onBehalfOf(officerX, entityId), { dossierId })).rejects.toMatchObject({ code: "not_found" });
  });

  it("is for a Cán bộ xã only: any other Vai trò acting for a Chủ thể is refused", async () => {
    const owner = await f.verifiedOwner();
    const other = await f.verifiedOwner();
    const province = await f.staff("province_officer");
    const { dossierId } = await t.app.dossiers.create(owner, { criteriaSetId: sets["Rau củ quả"] });

    for (const actor of [onBehalfOf(other, entityIdOf(owner)), onBehalfOf(province, entityIdOf(owner))]) {
      await expect(t.app.dossiers.create(actor, { criteriaSetId: sets["Rau củ quả"] })).rejects.toMatchObject({ code: "forbidden" });
      await expect(t.app.dossiers.updateProduct(actor, { dossierId, expectedVersion: 1, productName: "Khác" })).rejects.toMatchObject({ code: "forbidden" });
    }
  });

  it("does not let the officer do for the Chủ thể what is not Nhập hộ: rút, xóa Nháp", async () => {
    const owner = await f.verifiedOwner();
    const officer = onBehalfOf(officerX, entityIdOf(owner));
    const { dossierId } = await t.app.dossiers.create(officer, { criteriaSetId: sets["Rau củ quả"] });

    await expect(t.app.dossiers.delete(officer, { dossierId, expectedVersion: 1 })).rejects.toMatchObject({ code: "forbidden" });
    const version = await f.completeDraft(officer, dossierId);
    const { version: submitted } = await t.app.dossiers.submit(officer, { dossierId, expectedVersion: version });
    await expect(t.app.dossiers.withdraw(officer, { dossierId, expectedVersion: submitted, reason: "Thử" })).rejects.toMatchObject({ code: "forbidden" });
  });
});
