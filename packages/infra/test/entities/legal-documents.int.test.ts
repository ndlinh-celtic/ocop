import { randomBytes } from "node:crypto";
import type { UserActor } from "@ocop/core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedWards } from "../../src/seed/wards";
import { anonymous, createTestApp, createTestDatabase, EICAR, systemActor, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
let wardId: string;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const PASSWORD = "mat-khau-chu-the-1";
const START = new Date("2026-10-19T02:00:00Z");

let ip = 0;
let seq = 0;
/** A freshly registered and activated Chủ thể, signed in. */
async function owner(kind: "enterprise" | "cooperative" | "household" = "enterprise") {
  const n = ++seq;
  const email = `chu-the-${n}@example.vn`;
  const identifier = kind === "household" ? `0792000${String(n).padStart(5, "0")}` : `03${String(n).padStart(8, "0")}`;
  await t.app.entities.register(anonymous({ ip: `198.51.100.${++ip}` }), {
    kind,
    name: `Chủ thể ${n}`,
    identifier,
    address: "Ấp 1",
    representativeName: `Đại diện ${n}`,
    phone: "0901234567",
    email,
    wardId,
  });
  await t.drainJobs();
  const token = /kich-hoat\?token=([\w-]+)/.exec(t.mailbox.to(email).at(-1)!.text)![1]!;
  await t.app.identity.activateAccount(anonymous(), { token, password: PASSWORD });
  return t.signInAs(email, PASSWORD);
}

const idOf = (actor: UserActor) => actor.activeScope!.id!;

/** Uploads a PDF through the files flow (pre-signed PUT, then the scan) and returns its id. */
async function uploadPdf(actor: UserActor, content: Buffer = Buffer.concat([Buffer.from("%PDF-1.7\n"), randomBytes(500)]), scan = true) {
  const { fileId, upload } = await t.app.files.requestUpload(actor, {
    purpose: "legal_document",
    fileName: "Giấy phép.pdf",
    contentType: "application/pdf",
    size: content.length,
  });
  if (upload.kind !== "single") throw new Error("expected a single PUT");
  const res = await fetch(upload.url, { method: "PUT", headers: upload.headers, body: content });
  if (!res.ok) throw new Error(`PUT ${res.status}`);
  await t.app.files.completeUpload(actor, { fileId });
  if (scan) await t.drainJobs();
  return fileId;
}

async function addDocument(actor: UserActor, typeCode: string, over: { issuedOn?: string; validUntil?: string | null; replacesId?: string } = {}) {
  const fileId = await uploadPdf(actor);
  return t.app.entities.addLegalDocument(actor, {
    entityId: idOf(actor),
    typeCode,
    fileId,
    documentNumber: "123/GP",
    issuedOn: over.issuedOn ?? "2025-01-01",
    validUntil: over.validUntil === undefined ? null : over.validUntil,
    replacesId: over.replacesId,
  });
}

const stateOf = (standing: Awaited<ReturnType<TestApp["app"]["entities"]["getLegalStanding"]>>, typeCode: string) =>
  standing.requirements.find((r) => r.typeCode === typeCode);

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n");
  wardId = (await t.app.org.listWards())[0]!.id;
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("L01 CT-02 hồ sơ pháp lý and Đã xác thực (stories 5 to 8)", () => {
  it("a new Chủ thể is not Đã xác thực and sees each required Loại giấy tờ as missing", async () => {
    const a = await owner("enterprise");
    const standing = await t.app.entities.getLegalStanding(a, { entityId: idOf(a) });
    expect(standing.verified).toBe(false);
    expect(stateOf(standing, "business_registration")).toMatchObject({ required: true, state: "missing" });
    expect(stateOf(standing, "quality_declaration")).toMatchObject({ required: false, state: "missing" });
    expect(standing.documents).toEqual([]);
  });

  it("uploads a GPKD through the files flow and becomes Đã xác thực once it is scanned clean (stories 5, 7)", async () => {
    const a = await owner("enterprise");
    const fileId = await uploadPdf(a, undefined, false);
    const { documentId } = await t.app.entities.addLegalDocument(a, {
      entityId: idOf(a),
      typeCode: "business_registration",
      fileId,
      documentNumber: "0311111111",
      issuedOn: "2024-03-01",
      validUntil: null,
    });

    const scanning = await t.app.entities.getLegalStanding(a, { entityId: idOf(a) });
    expect(scanning.verified).toBe(false);
    expect(stateOf(scanning, "business_registration")).toMatchObject({ state: "scanning" });

    await t.drainJobs();
    const standing = await t.app.entities.getLegalStanding(a, { entityId: idOf(a) });
    expect(standing.verified).toBe(true);
    expect(stateOf(standing, "business_registration")).toMatchObject({ required: true, state: "valid" });
    expect(standing.documents).toEqual([
      expect.objectContaining({ id: documentId, typeCode: "business_registration", documentNumber: "0311111111", issuedOn: "2024-03-01", validUntil: null, file: { fileName: "Giấy phép.pdf", status: "clean" } }),
    ]);
  });

  it("stops being Đã xác thực when the clock passes the last valid day, with no write (story 7)", async () => {
    const a = await owner("cooperative");
    await addDocument(a, "business_registration", { validUntil: "2026-12-31" });
    expect((await t.app.entities.getLegalStanding(a, { entityId: idOf(a) })).verified).toBe(true);

    t.clock.set(new Date("2026-12-31T16:59:59Z")); // 23:59:59 on 31/12 in Vietnam: still valid
    expect((await t.app.entities.getLegalStanding(a, { entityId: idOf(a) })).verified).toBe(true);

    t.clock.set(new Date("2026-12-31T17:00:00Z")); // 00:00 on 01/01 in Vietnam
    const standing = await t.app.entities.getLegalStanding(a, { entityId: idOf(a) });
    expect(standing.verified).toBe(false);
    expect(stateOf(standing, "business_registration")).toMatchObject({ state: "expired" });
    expect(standing.documents[0]).toMatchObject({ expired: true });
  });

  it("a blocked file does not count, and cannot be attached once the scan has blocked it", async () => {
    const a = await owner();
    const pending = await uploadPdf(a, Buffer.from(EICAR), false);
    await t.app.entities.addLegalDocument(a, { entityId: idOf(a), typeCode: "business_registration", fileId: pending, issuedOn: "2025-01-01", validUntil: null });
    await t.drainJobs();
    const standing = await t.app.entities.getLegalStanding(a, { entityId: idOf(a) });
    expect(standing.verified).toBe(false);
    expect(stateOf(standing, "business_registration")).toMatchObject({ state: "blocked" });

    const blocked = await uploadPdf(a, Buffer.from(EICAR));
    await expect(
      t.app.entities.addLegalDocument(a, { entityId: idOf(a), typeCode: "food_safety", fileId: blocked, issuedOn: "2025-01-01", validUntil: null }),
    ).rejects.toMatchObject({ code: "file_blocked" });
  });

  it("which Loại giấy tờ are required per Loại tổ chức is configuration, not code (story 6)", async () => {
    const a = await owner("enterprise");
    const h = await owner("household");
    await addDocument(a, "business_registration");
    await addDocument(h, "business_registration");
    expect((await t.app.entities.getLegalStanding(a, { entityId: idOf(a) })).verified).toBe(true);

    await db.admin.query("UPDATE entity.legal_document_type SET required_for = ARRAY['enterprise'] WHERE code = 'food_safety'");
    await db.admin.query("INSERT INTO entity.legal_document_type (code, name, required_for, sort_order) VALUES ('trade_mark', 'Giấy chứng nhận nhãn hiệu', '{}', 9)");
    try {
      const a2 = await t.app.entities.getLegalStanding(a, { entityId: idOf(a) });
      expect(a2.verified).toBe(false);
      expect(stateOf(a2, "food_safety")).toMatchObject({ required: true, state: "missing" });
      expect(stateOf(a2, "trade_mark")).toMatchObject({ name: "Giấy chứng nhận nhãn hiệu", required: false });
      // A hộ sản xuất is untouched by a requirement for doanh nghiệp.
      expect((await t.app.entities.getLegalStanding(h, { entityId: idOf(h) })).verified).toBe(true);

      await addDocument(a, "food_safety", { validUntil: "2027-06-30" });
      expect((await t.app.entities.getLegalStanding(a, { entityId: idOf(a) })).verified).toBe(true);
    } finally {
      await db.admin.query("UPDATE entity.legal_document_type SET required_for = '{}' WHERE code = 'food_safety'");
    }
  });

  it("replacing a giấy tờ keeps the old one as history (story 8)", async () => {
    const a = await owner();
    const { documentId: first } = await addDocument(a, "business_registration", { validUntil: "2026-11-30" });
    t.clock.set(new Date("2026-11-15T03:00:00Z"));
    const { documentId: second } = await addDocument(a, "business_registration", { issuedOn: "2026-11-10", validUntil: "2031-11-09", replacesId: first });

    t.clock.set(new Date("2026-12-15T03:00:00Z")); // the old one has expired; the new one carries the Chủ thể
    const standing = await t.app.entities.getLegalStanding(a, { entityId: idOf(a) });
    expect(standing.verified).toBe(true);
    expect(standing.documents.map((d) => d.id)).toEqual([second]);
    expect(standing.history).toEqual([expect.objectContaining({ id: first, replacedBy: second, validUntil: "2026-11-30", expired: true })]);

    await expect(addDocument(a, "business_registration", { replacesId: first })).rejects.toMatchObject({ code: "legal_document_replaced" });
    await expect(addDocument(a, "food_safety", { replacesId: second })).rejects.toMatchObject({ code: "legal_document_type_mismatch" });
  });

  it("refuses bad dates, a Loại not configured, and a file that is not the Chủ thể's own upload", async () => {
    const a = await owner();
    const b = await owner();
    const input = (fileId: string, over: Record<string, unknown> = {}) => ({ entityId: idOf(a), typeCode: "business_registration", fileId, issuedOn: "2025-01-01", validUntil: null, ...over });
    const fileId = await uploadPdf(a);
    await expect(t.app.entities.addLegalDocument(a, input(fileId, { issuedOn: "2026-10-20" }))).rejects.toMatchObject({ code: "issued_in_future" });
    await expect(t.app.entities.addLegalDocument(a, input(fileId, { validUntil: "2024-12-31" }))).rejects.toMatchObject({ code: "valid_until_before_issue" });
    await expect(t.app.entities.addLegalDocument(a, input(fileId, { issuedOn: "2025-02-30" }))).rejects.toMatchObject({ code: "invalid_date" });
    await expect(t.app.entities.addLegalDocument(a, input(fileId, { typeCode: "nope" }))).rejects.toMatchObject({ code: "legal_document_type_invalid" });
    await expect(t.app.entities.addLegalDocument(a, input(await uploadPdf(b)))).rejects.toMatchObject({ code: "file_required" });

    await t.app.entities.addLegalDocument(a, input(fileId));
    await expect(t.app.entities.addLegalDocument(a, input(fileId))).rejects.toMatchObject({ code: "file_already_used" });
  });

  it("another Chủ thể can neither read nor add to this hồ sơ pháp lý (#14), Quản trị is forbidden", async () => {
    const a = await owner();
    const b = await owner();
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    await expect(t.app.entities.getLegalStanding(b, { entityId: idOf(a) })).rejects.toMatchObject({ code: "not_found" });
    const fileId = await uploadPdf(b);
    await expect(
      t.app.entities.addLegalDocument(b, { entityId: idOf(a), typeCode: "business_registration", fileId, issuedOn: "2025-01-01", validUntil: null }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.entities.getLegalStanding(admin, { entityId: idOf(a) })).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.files.requestUpload(admin, { purpose: "legal_document", fileName: "a.pdf", contentType: "application/pdf", size: 10 })).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(t.app.files.requestUpload(a, { fileName: "a.pdf", contentType: "application/pdf", size: 10 })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("adding and replacing are audited with an outbox event in the same transaction", async () => {
    const a = await owner();
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const { documentId: first } = await addDocument(a, "business_registration");
    const { documentId: second } = await addDocument(a, "business_registration", { replacesId: first });

    const audits = await t.app.audit.search(admin, { action: ["entity.legal_document.added", "entity.legal_document.replaced"], targetId: idOf(a) });
    expect(audits.map((r) => [r.action, (r.after as { documentId: string }).documentId])).toEqual(
      expect.arrayContaining([
        ["entity.legal_document.added", first],
        ["entity.legal_document.replaced", second],
      ]),
    );
    expect(audits.find((r) => r.action === "entity.legal_document.replaced")).toMatchObject({ actorUserId: a.userId, actorRole: "entity_owner", metadata: { replacesId: first } });
    const events = await db.admin.query("SELECT type, payload FROM platform.outbox WHERE payload->>'entityId' = $1 AND type LIKE 'entity.legal_document.%' ORDER BY type", [idOf(a)]);
    expect(events.rows).toEqual([
      { type: "entity.legal_document.added", payload: { entityId: idOf(a), documentId: first, replacesId: null } },
      { type: "entity.legal_document.replaced", payload: { entityId: idOf(a), documentId: second, replacesId: first } },
    ]);
  });

  it("the database keeps giấy tờ immutable for the app: no edit, no delete, replaced only once", async () => {
    const a = await owner();
    const { documentId: first } = await addDocument(a, "business_registration");
    const { documentId: second } = await addDocument(a, "business_registration", { replacesId: first });
    await expect(db.app.query("UPDATE entity.legal_document SET valid_until = '2099-01-01' WHERE id = $1", [second])).rejects.toThrow(/immutable/);
    await expect(db.app.query("DELETE FROM entity.legal_document WHERE id = $1", [first])).rejects.toThrow(/permission denied|cannot be deleted/);
    await expect(db.app.query("UPDATE entity.legal_document SET replaced_by = $2, replaced_at = now() WHERE id = $1", [first, first])).rejects.toThrow(/immutable/);
    await expect(db.app.query("UPDATE entity.legal_document SET replaced_by = NULL, replaced_at = NULL WHERE id = $1", [first])).rejects.toThrow(/immutable/);
  });
});
