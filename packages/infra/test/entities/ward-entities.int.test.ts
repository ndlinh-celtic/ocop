import { randomBytes } from "node:crypto";
import type { UserActor } from "@ocop/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedWards } from "../../src/seed/wards";
import { anonymous, createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
let wardA: string;
let wardB: string;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const PASSWORD = "mat-khau-nguoi-dung-1";

let admin: UserActor;
let officerA: UserActor;
let officerB: UserActor;
let ownerA: UserActor;
let householdA: UserActor;
let ownerB: UserActor;

let ip = 0;
async function activate(email: string) {
  await t.drainJobs();
  const token = /kich-hoat\?token=([\w-]+)/.exec(t.mailbox.to(email).at(-1)!.text)![1]!;
  await t.app.identity.activateAccount(anonymous(), { token, password: PASSWORD });
  return t.signInAs(email, PASSWORD);
}

async function owner(kind: "enterprise" | "household", identifier: string, email: string, name: string, wardId: string) {
  await t.app.entities.register(anonymous({ ip: `198.51.100.${++ip}` }), {
    kind,
    name,
    identifier,
    address: "Ấp 1",
    representativeName: `Đại diện ${name}`,
    phone: "0901234567",
    email,
    wardId,
  });
  return activate(email);
}

async function officer(email: string, wardId: string) {
  const { userId } = await t.app.identity.createStaffUser(admin, { email, fullName: `Cán bộ ${email}` });
  await t.drainJobs();
  const token = /kich-hoat\?token=([\w-]+)/.exec(t.mailbox.to(email).at(-1)!.text)![1]!;
  await t.app.identity.activateAccount(anonymous(), { token, password: PASSWORD });
  await t.app.identity.grantRole(admin, { userId, role: "ward_officer", scopeId: wardId });
  return t.signInAs(email, PASSWORD);
}

const idOf = (actor: UserActor) => actor.activeScope!.id!;

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n00002,Xã Bình Hòa\n");
  const wards = await t.app.org.listWards();
  wardA = wards.find((w) => w.name === "Xã An Phú")!.id;
  wardB = wards.find((w) => w.name === "Xã Bình Hòa")!.id;
  admin = await t.signInAs(ADMIN.email, ADMIN.password);
  officerA = await officer("canbo.anphu@xa.gov.vn", wardA);
  officerB = await officer("canbo.binhhoa@xa.gov.vn", wardB);
  ownerA = await owner("enterprise", "0311111111", "a@example.vn", "Chủ thể A", wardA);
  householdA = await owner("household", "079200001234", "ho@example.vn", "Hộ C", wardA);
  ownerB = await owner("enterprise", "0322222222", "b@example.vn", "Chủ thể B", wardB);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("L01 Cán bộ xã sees the Chủ thể registered in their xã (#14, story 77)", () => {
  it("lists only the Chủ thể đăng ký ở xã mình", async () => {
    expect((await t.app.entities.listEntities(officerA)).map((e) => e.name)).toEqual(["Chủ thể A", "Hộ C"]);
    expect((await t.app.entities.listEntities(officerB)).map((e) => e.name)).toEqual(["Chủ thể B"]);
  });

  it("reads a Chủ thể of their xã with its hồ sơ pháp lý; one of another xã is not found", async () => {
    expect(await t.app.entities.getEntity(officerA, { entityId: idOf(ownerA) })).toMatchObject({ name: "Chủ thể A", representativeEmail: "a@example.vn" });
    expect(await t.app.entities.getLegalStanding(officerA, { entityId: idOf(ownerA) })).toMatchObject({ verified: false });
    await expect(t.app.entities.getEntity(officerA, { entityId: idOf(ownerB) })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.entities.getLegalStanding(officerA, { entityId: idOf(ownerB) })).rejects.toMatchObject({ code: "not_found" });
  });

  it("follows the Chủ thể when it moves to another xã đăng ký", async () => {
    const entity = await t.app.entities.getEntity(ownerB, { entityId: idOf(ownerB) });
    await t.app.entities.updateEntity(ownerB, { entityId: entity.id, ...entity, wardId: wardA });
    try {
      expect((await t.app.entities.listEntities(officerA)).map((e) => e.name)).toContain("Chủ thể B");
      await expect(t.app.entities.getEntity(officerB, { entityId: entity.id })).rejects.toMatchObject({ code: "not_found" });
    } finally {
      await t.app.entities.updateEntity(ownerB, { entityId: entity.id, ...entity, wardId: wardB });
    }
  });
});

describe("L01 contact details of the người đại diện are personal data (NĐ 13/2023)", () => {
  it("audits a Cán bộ xã reading a Chủ thể or the list of them; a Chủ thể reading itself is not audited", async () => {
    const reader = await officer("canbo.doc@xa.gov.vn", wardA);

    await t.app.entities.getEntity(reader, { entityId: idOf(ownerA) });
    await t.app.entities.listEntities(reader);
    await t.app.entities.getEntity(ownerA, { entityId: idOf(ownerA) });
    await t.app.entities.listEntities(ownerA);

    const views = await t.app.audit.search(admin, { action: ["personal_data.viewed"], actorUserId: reader.userId });
    expect(views.map((v) => v.metadata)).toEqual(expect.arrayContaining([{ view: "entity_detail" }, { view: "entity_list", count: 2 }]));
    expect(views).toHaveLength(2);
    expect(views.find((v) => v.metadata?.view === "entity_detail")).toMatchObject({ actorRole: "ward_officer", targetType: "entity", targetId: idOf(ownerA) });
    expect(await t.app.audit.search(admin, { action: ["personal_data.viewed"], actorUserId: ownerA.userId })).toEqual([]);
  });
});

describe("L01 Cán bộ xã checks the identity of a Chủ thể of their xã (stories 14, 44)", () => {
  it("sees the số định danh masked, and the full number only through its own use case, audited on every call", async () => {
    expect(await t.app.entities.getEntity(officerA, { entityId: idOf(householdA) })).toMatchObject({ identifier: "••••••••1234" });
    expect(await t.app.entities.revealPersonalId(officerA, { entityId: idOf(householdA) })).toEqual({ personalId: "079200001234" });
    await t.app.entities.revealPersonalId(officerA, { entityId: idOf(householdA) });
    const views = (await t.app.audit.search(admin, { action: ["personal_data.viewed"], targetId: idOf(householdA), actorUserId: officerA.userId })).filter(
      (v) => v.metadata?.view === "entity_personal_id",
    );
    expect(views).toHaveLength(2);
    expect(views[0]).toMatchObject({ actorRole: "ward_officer", targetType: "entity", metadata: { view: "entity_personal_id" } });
  });

  it("cannot reveal the số định danh of a Chủ thể of another xã", async () => {
    await expect(t.app.entities.revealPersonalId(officerB, { entityId: idOf(householdA) })).rejects.toMatchObject({ code: "not_found" });
    const views = await t.app.audit.search(admin, { action: ["personal_data.viewed"], targetId: idOf(householdA), actorUserId: officerB.userId });
    expect(views).toEqual([]);
  });

  it("downloads the giấy tờ pháp lý of a Chủ thể of their xã, audited; another xã gets not found", async () => {
    const content = Buffer.concat([Buffer.from("%PDF-1.7\n"), randomBytes(200)]);
    const { fileId, upload } = await t.app.files.requestUpload(ownerA, { purpose: "legal_document", fileName: "GPKD.pdf", contentType: "application/pdf", size: content.length });
    if (upload.kind !== "single") throw new Error("expected a single PUT");
    await fetch(upload.url, { method: "PUT", headers: upload.headers, body: content });
    await t.app.files.completeUpload(ownerA, { fileId });
    await t.drainJobs();
    const { documentId } = await t.app.entities.addLegalDocument(ownerA, {
      entityId: idOf(ownerA),
      typeCode: "business_registration",
      fileId,
      issuedOn: "2025-01-01",
      validUntil: null,
    });

    const { url } = await t.app.entities.downloadLegalDocument(officerA, { entityId: idOf(ownerA), documentId });
    expect(Buffer.from(await (await fetch(url)).arrayBuffer())).toEqual(content);
    expect((await t.app.entities.downloadLegalDocument(ownerA, { entityId: idOf(ownerA), documentId })).url).toBeTruthy();
    const issued = await t.app.audit.search(admin, { action: ["file.download_issued"], targetId: fileId, actorUserId: officerA.userId });
    expect(issued[0]).toMatchObject({ actorRole: "ward_officer", metadata: { entityId: idOf(ownerA), documentId } });

    await expect(t.app.entities.downloadLegalDocument(officerB, { entityId: idOf(ownerA), documentId })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.entities.downloadLegalDocument(officerA, { entityId: idOf(householdA), documentId })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.entities.downloadLegalDocument(ownerB, { entityId: idOf(ownerA), documentId })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("Permission matrix: Cán bộ xã on Chủ thể (#14)", () => {
  const ownWard = () => idOf(ownerA);
  const otherWard = () => idOf(ownerB);
  const cases: [string, (entityId: string) => Promise<unknown>][] = [
    ["getEntity", (entityId) => t.app.entities.getEntity(officerA, { entityId })],
    ["getLegalStanding", (entityId) => t.app.entities.getLegalStanding(officerA, { entityId })],
    ["revealPersonalId", (entityId) => t.app.entities.revealPersonalId(officerA, { entityId })],
    ["changeRepresentativeEmail", (entityId) => t.app.entities.changeRepresentativeEmail(officerA, { entityId, email: "khong-doi@example.vn" })],
  ];

  it.each(cases)("%s on a Chủ thể of another xã is not found", async (_name, call) => {
    await expect(call(otherWard())).rejects.toMatchObject({ code: "not_found" });
  });

  it.each(cases.slice(0, 2))("%s on a Chủ thể of their own xã is allowed", async (_name, call) => {
    await expect(call(ownWard())).resolves.toBeTruthy();
  });

  it("a Cán bộ xã does not edit the Chủ thể's own details or giấy tờ", async () => {
    const entity = await t.app.entities.getEntity(officerA, { entityId: ownWard() });
    await expect(t.app.entities.updateEntity(officerA, { entityId: entity.id, ...entity, wardId: wardA })).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      t.app.entities.addLegalDocument(officerA, { entityId: entity.id, typeCode: "business_registration", fileId: entity.id, issuedOn: "2025-01-01", validUntil: null }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("the scope follows the Vai trò đang dùng: the same person as Chủ thể sees only their own Chủ thể", async () => {
    expect((await t.app.entities.listEntities(ownerA)).map((e) => e.id)).toEqual([ownWard()]);
  });
});

describe("L01 Cán bộ xã creates a Chủ thể for a hộ sản xuất of their xã (story 11)", () => {
  const household = {
    kind: "household" as const,
    name: "Hộ Nguyễn Văn D",
    identifier: "079 200 005 678",
    address: "Ấp 2",
    representativeName: "Nguyễn Văn D",
    phone: "0907654321",
    email: "nguyenvand@example.vn",
  };

  it("creates the Chủ thể in the officer's own xã with its Người dùng đại diện, who activates by email", async () => {
    const { entityId } = await t.app.entities.createEntity(officerA, household);
    expect(await t.app.entities.getEntity(officerA, { entityId })).toMatchObject({
      name: "Hộ Nguyễn Văn D",
      identifier: "••••••••5678",
      ward: { id: wardA },
      representativeEmail: "nguyenvand@example.vn",
      representativeActivated: false,
    });
    await expect(t.app.entities.getEntity(officerB, { entityId })).rejects.toMatchObject({ code: "not_found" });

    const representative = await activate("nguyenvand@example.vn");
    expect(representative).toMatchObject({ activeRole: "entity_owner", activeScope: { type: "entity", id: entityId } });
    expect(await t.app.entities.getEntity(officerA, { entityId })).toMatchObject({ representativeActivated: true });
  });

  it("audits the officer as the one who created it, with an outbox event", async () => {
    const { entityId } = await t.app.entities.createEntity(officerA, { ...household, identifier: "079200009999", email: "ho.e@example.vn", name: "Hộ E" });
    const [created] = await t.app.audit.search(admin, { action: ["entity.created"], targetId: entityId });
    expect(created).toMatchObject({ actorUserId: officerA.userId, actorRole: "ward_officer", after: { kind: "household", name: "Hộ E", wardId: wardA } });
    const events = await db.admin.query("SELECT type FROM platform.outbox WHERE payload->>'entityId' = $1", [entityId]);
    expect(events.rows).toEqual([{ type: "entity.created" }]);
  });

  it("refuses an identifier or email already in use", async () => {
    await expect(t.app.entities.createEntity(officerA, { ...household, kind: "enterprise", identifier: "0322222222", email: "moi@example.vn" })).rejects.toMatchObject({
      code: "identifier_taken",
    });
    await expect(t.app.entities.createEntity(officerA, { ...household, identifier: "079200007777", email: "B@example.vn" })).rejects.toMatchObject({ code: "email_taken" });
  });

  it("a Chủ thể created by the officer is registered in the officer's xã; no ward can be chosen", async () => {
    const { entityId } = await t.app.entities.createEntity(officerB, { ...household, identifier: "079200006666", email: "ho.f@example.vn", wardId: wardA } as never);
    expect(await t.app.entities.getEntity(officerB, { entityId })).toMatchObject({ ward: { id: wardB } });
  });

  it("only a Cán bộ xã creates a Chủ thể", async () => {
    const input = { ...household, identifier: "079200008888", email: "x@example.vn" };
    await expect(t.app.entities.createEntity(ownerA, input)).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.entities.createEntity(admin, input)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("L01 Cán bộ xã changes the email of a Người dùng đại diện of their xã (story 12)", () => {
  it("the Chủ thể signs in and recovers the account with the new email; the old one no longer works", async () => {
    const chuThe = await owner("enterprise", "0333333333", "cu@example.vn", "Chủ thể G", wardA);
    await t.app.entities.changeRepresentativeEmail(officerA, { entityId: idOf(chuThe), email: " Moi@Example.vn " });

    expect(await t.app.entities.getEntity(officerA, { entityId: idOf(chuThe) })).toMatchObject({ representativeEmail: "Moi@Example.vn" });
    await expect(t.signInAs("cu@example.vn", PASSWORD)).rejects.toThrow();
    expect(await t.signInAs("moi@example.vn", PASSWORD)).toMatchObject({ userId: chuThe.userId, activeScope: { id: idOf(chuThe) } });

    await t.app.identity.requestPasswordReset(anonymous(), { email: "moi@example.vn" });
    await t.drainJobs();
    expect(t.mailbox.to("Moi@Example.vn").at(-1)!.text).toMatch(/dat-lai-mat-khau\?token=/);
  });

  it("an earlier link sent to the old address stops working", async () => {
    const { entityId } = await t.app.entities.createEntity(officerA, {
      kind: "household",
      name: "Hộ H",
      identifier: "079200005555",
      address: "Ấp 3",
      representativeName: "Trần Thị H",
      phone: "0907654321",
      email: "h.cu@example.vn",
    });
    await t.drainJobs();
    const oldToken = /kich-hoat\?token=([\w-]+)/.exec(t.mailbox.to("h.cu@example.vn").at(-1)!.text)![1]!;

    await t.app.entities.changeRepresentativeEmail(officerA, { entityId, email: "h.moi@example.vn" });
    expect(await t.app.identity.activateAccount(anonymous(), { token: oldToken, password: PASSWORD })).toMatchObject({ ok: false });
    const representative = await activate("h.moi@example.vn");
    expect(representative).toMatchObject({ activeScope: { type: "entity", id: entityId } });
  });

  it("is audited with both addresses and announced through the outbox", async () => {
    const chuThe = await owner("enterprise", "0344444444", "k.cu@example.vn", "Chủ thể K", wardA);
    await t.app.entities.changeRepresentativeEmail(officerA, { entityId: idOf(chuThe), email: "k.moi@example.vn" });
    const [changed] = await t.app.audit.search(admin, { action: ["entity.representative_email_changed"], targetId: idOf(chuThe) });
    expect(changed).toMatchObject({
      actorUserId: officerA.userId,
      actorRole: "ward_officer",
      before: { email: "k.cu@example.vn" },
      after: { email: "k.moi@example.vn" },
      metadata: { userId: chuThe.userId },
    });
    const events = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'entity.representative_email_changed' AND payload->>'entityId' = $1", [idOf(chuThe)]);
    expect(events.rows).toEqual([{ payload: { entityId: idOf(chuThe), userId: chuThe.userId } }]);
  });

  it("refuses an invalid email, the same email, or one used by another account", async () => {
    await expect(t.app.entities.changeRepresentativeEmail(officerA, { entityId: idOf(ownerA), email: "khong-hop-le" })).rejects.toMatchObject({ code: "email_invalid" });
    await expect(t.app.entities.changeRepresentativeEmail(officerA, { entityId: idOf(ownerA), email: "A@example.vn" })).rejects.toMatchObject({ code: "email_unchanged" });
    await expect(t.app.entities.changeRepresentativeEmail(officerA, { entityId: idOf(ownerA), email: "b@example.vn" })).rejects.toMatchObject({ code: "email_taken" });
  });

  it("a Chủ thể of another xã is not found, and only a Cán bộ xã may do it", async () => {
    await expect(t.app.entities.changeRepresentativeEmail(officerB, { entityId: idOf(ownerA), email: "z@example.vn" })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.entities.changeRepresentativeEmail(officerA, { entityId: "not-an-id", email: "z@example.vn" })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.entities.changeRepresentativeEmail(ownerA, { entityId: idOf(ownerA), email: "z@example.vn" })).rejects.toMatchObject({ code: "forbidden" });
    expect(await t.app.entities.getEntity(officerA, { entityId: idOf(ownerA) })).toMatchObject({ representativeEmail: "a@example.vn" });
  });
});
