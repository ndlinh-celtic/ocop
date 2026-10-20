import type { UserActor } from "@ocop/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedWards } from "../../src/seed/wards";
import { anonymous, createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
let wardId: string;
let otherWardId: string;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const PASSWORD = "mat-khau-chu-the-1";

let seq = 0;
async function owner(kind: "enterprise" | "household", identifier: string) {
  const n = ++seq;
  const email = `chu-the-${n}@example.vn`;
  await t.app.entities.register(anonymous({ ip: `198.51.100.${n}` }), {
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

let a: UserActor;
let b: UserActor;
let household: UserActor;
let admin: UserActor;

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n00002,Phường Mẫu Hai\n");
  const wards = await t.app.org.listWards();
  wardId = wards.find((w) => w.name === "Xã An Phú")!.id;
  otherWardId = wards.find((w) => w.name === "Phường Mẫu Hai")!.id;
  a = await owner("enterprise", "0311111111");
  b = await owner("enterprise", "0322222222");
  household = await owner("household", "079200001234");
  admin = await t.signInAs(ADMIN.email, ADMIN.password);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

const details = (over: Record<string, string> = {}) => ({
  name: "Công ty TNHH Mắm Bà Sáu",
  address: "Số 5, đường 30/4",
  representativeName: "Nguyễn Thị Sáu",
  phone: "0918 452 247",
  wardId,
  ...over,
});

describe("L01 CT-02 Chủ thể edits its organisation details (stories 9, 10)", () => {
  it("updates its details, audited with before and after and an outbox event", async () => {
    await t.app.entities.updateEntity(a, { entityId: idOf(a), ...details() });
    expect(await t.app.entities.getEntity(a, { entityId: idOf(a) })).toMatchObject({
      name: "Công ty TNHH Mắm Bà Sáu",
      address: "Số 5, đường 30/4",
      representativeName: "Nguyễn Thị Sáu",
      phone: "0918452247",
      identifier: "0311111111",
      ward: { id: wardId, name: "Xã An Phú" },
    });
    const [audit] = await t.app.audit.search(admin, { action: ["entity.updated"], targetId: idOf(a) });
    expect(audit).toMatchObject({
      actorUserId: a.userId,
      actorRole: "entity_owner",
      before: { name: "Chủ thể 1", address: "Ấp 1" },
      after: { name: "Công ty TNHH Mắm Bà Sáu", address: "Số 5, đường 30/4" },
    });
    const events = await db.admin.query("SELECT type FROM platform.outbox WHERE payload->>'entityId' = $1 AND type IN ('entity.updated', 'entity.ward_changed')", [idOf(a)]);
    expect(events.rows).toEqual([{ type: "entity.updated" }]);
  });

  it("changing the xã/phường đăng ký is audited on its own and emits entity.ward_changed", async () => {
    await t.app.entities.updateEntity(b, { entityId: idOf(b), ...details({ wardId: otherWardId }) });
    expect(await t.app.entities.getEntity(b, { entityId: idOf(b) })).toMatchObject({ ward: { id: otherWardId, name: "Phường Mẫu Hai" } });
    const [audit] = await t.app.audit.search(admin, { action: ["entity.ward_changed"], targetId: idOf(b) });
    expect(audit).toMatchObject({ actorUserId: b.userId, before: { wardId }, after: { wardId: otherWardId } });
    const events = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'entity.ward_changed' AND payload->>'entityId' = $1", [idOf(b)]);
    expect(events.rows).toEqual([{ payload: { entityId: idOf(b), fromWardId: wardId, toWardId: otherWardId } }]);
  });

  it("refuses blank details, a bad phone or an unknown xã/phường", async () => {
    await expect(t.app.entities.updateEntity(a, { entityId: idOf(a), ...details({ name: "  " }) })).rejects.toMatchObject({ code: "name_required" });
    await expect(t.app.entities.updateEntity(a, { entityId: idOf(a), ...details({ phone: "12" }) })).rejects.toMatchObject({ code: "phone_invalid" });
    await expect(t.app.entities.updateEntity(a, { entityId: idOf(a), ...details({ wardId: "019a0000-0000-7000-8000-000000000000" }) })).rejects.toMatchObject({
      code: "ward_required",
    });
  });

  it("another Chủ thể cannot edit it (#14), Quản trị is forbidden", async () => {
    await expect(t.app.entities.updateEntity(b, { entityId: idOf(a), ...details({ name: "Chiếm" }) })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.entities.updateEntity(admin, { entityId: idOf(a), ...details() })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("L01 số định danh cá nhân of a hộ sản xuất (story 13, NĐ 13/2023)", () => {
  it("is masked to the last four digits by default, even for the hộ itself", async () => {
    expect(await t.app.entities.getEntity(household, { entityId: idOf(household) })).toMatchObject({ identifier: "••••••••1234" });
    expect((await t.app.entities.listEntities(household))[0]).toMatchObject({ identifier: "••••••••1234" });
  });

  it("is shown in full only through its own use case, audited as a personal data access", async () => {
    expect(await t.app.entities.revealPersonalId(household, { entityId: idOf(household) })).toEqual({ personalId: "079200001234" });
    const [audit] = await t.app.audit.search(admin, { action: ["personal_data.viewed"], targetId: idOf(household) });
    expect(audit).toMatchObject({ actorUserId: household.userId, targetType: "entity", metadata: { view: "entity_personal_id" } });
  });

  it("cannot be revealed for another Chủ thể, nor for one identified by mã số thuế", async () => {
    await expect(t.app.entities.revealPersonalId(a, { entityId: idOf(household) })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.entities.revealPersonalId(a, { entityId: idOf(a) })).rejects.toMatchObject({ code: "no_personal_id" });
    await expect(t.app.entities.revealPersonalId(admin, { entityId: idOf(household) })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("stays sealed and unique by fingerprint after the hộ edits its details", async () => {
    await t.app.entities.updateEntity(household, { entityId: idOf(household), ...details({ name: "Hộ bà Sáu" }) });
    const leaked = await db.admin.query("SELECT count(*)::int AS n FROM entity.entity e WHERE row_to_json(e)::text LIKE '%079200001234%'");
    expect(leaked.rows[0]).toEqual({ n: 0 });
    expect(await t.app.entities.revealPersonalId(household, { entityId: idOf(household) })).toEqual({ personalId: "079200001234" });
  });
});
