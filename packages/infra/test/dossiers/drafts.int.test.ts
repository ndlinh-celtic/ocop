import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, entityIdOf, fixtures, PRODUCT } from "./fixtures";

let db: TestDatabase;
let t: TestApp;
let wardId: string;
let f: ReturnType<typeof fixtures>;
/** The only published version and no đợt: every new hồ sơ uses it. */
let versionId: string;
let sets: Record<"Rau củ quả" | "Thịt tươi", string>;
const START = new Date("2026-10-19T02:00:00Z");

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n");
  wardId = (await t.app.org.listWards())[0]!.id;
  f = fixtures(t, () => wardId);
  ({ versionId, sets } = await f.publishedVersion("26/2026/QĐ-TTg"));
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("L02 CT-03 tạo hồ sơ Nháp theo Bộ tiêu chí (stories 15 to 19)", () => {
  it("a Chủ thể Đã xác thực creates a Nháp on a Bộ tiêu chí and finds it in its list", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });

    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({
      id: dossierId,
      state: "draft",
      entityId: entityIdOf(a),
      criteriaSet: { id: sets["Rau củ quả"], name: "Rau củ quả" },
      criteriaVersion: { id: versionId, legalBasis: "26/2026/QĐ-TTg" },
      wardId: null,
      roundId: null,
      copiedFrom: null,
      version: 1,
      evidence: [],
    });
    expect(await t.app.dossiers.list(a)).toEqual([expect.objectContaining({ id: dossierId, state: "draft" })]);
  });

  it("refuses a Chủ thể that is not Đã xác thực (story 15)", async () => {
    const a = await f.owner();
    await expect(t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] })).rejects.toMatchObject({ code: "entity_not_verified" });
    expect(await t.app.dossiers.list(a)).toEqual([]);
  });

  it("records the creation on the timeline, in the audit log and in the outbox", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Thịt tươi"] });

    expect(await t.app.dossiers.timeline(a, { dossierId })).toEqual([
      expect.objectContaining({ action: "dossier.create", fromState: null, toState: "draft", actorUserId: a.userId, actorRole: "entity_owner", occurredAt: START }),
    ]);
    const [entry] = await t.app.audit.search(await f.admin(), { action: ["dossier.create"], targetId: dossierId });
    expect(entry).toMatchObject({ actorUserId: a.userId, actorRole: "entity_owner", targetType: "dossier", metadata: { criteriaSetId: sets["Thịt tươi"] } });
    const { rows } = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'dossier.created' AND payload->>'dossierId' = $1", [dossierId]);
    expect(rows).toEqual([{ payload: { dossierId, entityId: entityIdOf(a), from: null, to: "draft" } }]);
  });

  it("autosaves thông tin sản phẩm on a Nháp, each save bumping the version (stories 18, 19)", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });

    expect(await t.app.dossiers.updateProduct(a, { dossierId, expectedVersion: 1, productName: "  Bưởi da xanh  " })).toEqual({ version: 2 });
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ productName: "Bưởi da xanh", description: "" });
    expect(await t.app.dossiers.updateProduct(a, { dossierId, expectedVersion: 2, ...PRODUCT })).toEqual({ version: 3 });

    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ ...PRODUCT, version: 3 });
    // Autosaves are audited, but are not rows of the timeline.
    expect(await t.app.dossiers.timeline(a, { dossierId })).toHaveLength(1);
    const saves = await t.app.audit.search(await f.admin(), { action: ["dossier.edit"], targetId: dossierId });
    expect(saves.map((e) => e.after)).toEqual(expect.arrayContaining([{ state: "draft", version: 2 }, { state: "draft", version: 3 }]));
    expect(saves).toHaveLength(2);
  });

  it("refuses the second of two saves made from the same version (story 87)", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });

    const results = await Promise.allSettled([
      t.app.dossiers.updateProduct(a, { dossierId, expectedVersion: 1, productName: "Bản thứ nhất" }),
      t.app.dossiers.updateProduct(a, { dossierId, expectedVersion: 1, productName: "Bản thứ hai" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "version_conflict" } });
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ version: 2 });
  });
});

describe("L02 CT-03 xóa and Sao chép sang hồ sơ mới (stories 26, 27)", () => {
  it("deletes a Nháp: it leaves the list and is not found, and the deletion is on record", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    await t.app.dossiers.delete(a, { dossierId, expectedVersion: 1 });

    expect((await t.app.dossiers.list(a)).map((d) => d.id)).not.toContain(dossierId);
    await expect(t.app.dossiers.get(a, { dossierId })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.dossiers.delete(a, { dossierId, expectedVersion: 2 })).rejects.toMatchObject({ code: "not_found" });
    expect(await t.app.audit.search(await f.admin(), { action: ["dossier.delete"], targetId: dossierId })).toHaveLength(1);
    const { rows } = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'dossier.deleted' AND payload->>'dossierId' = $1", [dossierId]);
    expect(rows).toHaveLength(1);
  });

  it("copies thông tin sản phẩm and the kho minh chứng into a new Nháp on a Bộ tiêu chí chosen again", async () => {
    const a = await f.verifiedOwner();
    const { dossierId: sourceId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    await t.app.dossiers.updateProduct(a, { dossierId: sourceId, expectedVersion: 1, ...PRODUCT });
    const fileId = await f.uploadPdf(a, "evidence", "Kết quả kiểm nghiệm.pdf");
    await t.app.dossiers.addEvidenceFile(a, { dossierId: sourceId, expectedVersion: 2, fileId });

    const { dossierId } = await t.app.dossiers.copy(a, { dossierId: sourceId, criteriaSetId: sets["Thịt tươi"] });

    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({
      ...PRODUCT,
      state: "draft",
      version: 1,
      criteriaSet: { name: "Thịt tươi" },
      copiedFrom: { id: sourceId, productName: PRODUCT.productName },
      evidence: [{ fileId, fileName: "Kết quả kiểm nghiệm.pdf", status: "clean" }],
    });
    expect(await t.app.dossiers.timeline(a, { dossierId })).toEqual([
      expect.objectContaining({ action: "dossier.create", metadata: expect.objectContaining({ copiedFrom: sourceId }) }),
    ]);
    // The source is untouched.
    expect(await t.app.dossiers.get(a, { dossierId: sourceId })).toMatchObject({ version: 3, criteriaSet: { name: "Rau củ quả" } });
  });

  it("takes into the kho only an evidence file the Chủ thể itself uploaded", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    const legal = await f.uploadPdf(a, "legal_document");
    await expect(t.app.dossiers.addEvidenceFile(a, { dossierId, expectedVersion: 1, fileId: legal })).rejects.toMatchObject({ code: "file_required" });
    const b = await f.verifiedOwner();
    const ofB = await f.uploadPdf(b, "evidence");
    await expect(t.app.dossiers.addEvidenceFile(a, { dossierId, expectedVersion: 1, fileId: ofB })).rejects.toMatchObject({ code: "file_required" });
  });
});

describe("L02 Phạm vi and state of a hồ sơ (stories 32, 76, 80, 81, 83)", () => {
  it("another Chủ thể neither lists, reads, edits, deletes nor copies it: not found", async () => {
    const a = await f.verifiedOwner();
    const b = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });

    expect((await t.app.dossiers.list(b)).map((d) => d.id)).not.toContain(dossierId);
    const notFound = { code: "not_found" };
    await expect(t.app.dossiers.get(b, { dossierId })).rejects.toMatchObject(notFound);
    await expect(t.app.dossiers.timeline(b, { dossierId })).rejects.toMatchObject(notFound);
    await expect(t.app.dossiers.updateProduct(b, { dossierId, expectedVersion: 1, productName: "x" })).rejects.toMatchObject(notFound);
    await expect(t.app.dossiers.delete(b, { dossierId, expectedVersion: 1 })).rejects.toMatchObject(notFound);
    await expect(t.app.dossiers.copy(b, { dossierId, criteriaSetId: sets["Rau củ quả"] })).rejects.toMatchObject(notFound);
    await expect(t.app.dossiers.get(b, { dossierId: "not-a-uuid" })).rejects.toMatchObject(notFound);
  });

  it("Quản trị and Cán bộ Sở neither read nor start a hồ sơ of a Chủ thể (story 83)", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    for (const other of [await f.admin(), await f.staff("province_officer")]) {
      await expect(t.app.dossiers.get(other, { dossierId })).rejects.toMatchObject({ code: "forbidden" });
      await expect(t.app.dossiers.list(other)).rejects.toMatchObject({ code: "forbidden" });
      await expect(t.app.dossiers.create(other, { criteriaSetId: sets["Rau củ quả"] })).rejects.toMatchObject({ code: "forbidden" });
    }
  });

  it("thông tin sản phẩm is not editable, and the hồ sơ not deletable, once it has left Nháp (story 32)", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    await f.openRound(versionId);
    const { version } = await t.app.dossiers.submit(a, { dossierId, expectedVersion: await f.completeDraft(a, dossierId) });

    await expect(t.app.dossiers.updateProduct(a, { dossierId, expectedVersion: version, productName: "Sửa sau khi nộp" })).rejects.toMatchObject({ code: "invalid_state" });
    await expect(t.app.dossiers.delete(a, { dossierId, expectedVersion: version })).rejects.toMatchObject({ code: "invalid_state" });
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ state: "submitted_to_ward", productName: PRODUCT.productName, version });
  });
});

describe("hồ sơ in the database (three-layer protection)", () => {
  it("the app user can neither move a hồ sơ to another Bộ tiêu chí, skip its version, delete it, nor rewrite its events", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    await expect(
      db.app.query("UPDATE dossier.dossier SET criteria_set_id = $2, version = version + 1 WHERE id = $1", [dossierId, sets["Thịt tươi"]]),
    ).rejects.toThrow(/fixed/);
    await expect(db.app.query("UPDATE dossier.dossier SET product_name = 'x' WHERE id = $1", [dossierId])).rejects.toThrow(/version/);
    await expect(db.app.query("DELETE FROM dossier.dossier WHERE id = $1", [dossierId])).rejects.toThrow(/permission denied/);
    await expect(db.app.query("UPDATE dossier.dossier_event SET reason = 'x' WHERE dossier_id = $1", [dossierId])).rejects.toThrow(/permission denied/);
  });
});
