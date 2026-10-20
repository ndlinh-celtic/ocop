import type { UserActor } from "@ocop/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedWards } from "../../src/seed/wards";
import { anonymous, createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
let wardId: string;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const PASSWORD = "mat-khau-chu-the-1";

let a: UserActor;
let b: UserActor;
let household: UserActor;
let admin: UserActor;

let ip = 0;
async function owner(kind: "enterprise" | "household", identifier: string, email: string, name: string) {
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
  await t.drainJobs();
  const token = /kich-hoat\?token=([\w-]+)/.exec(t.mailbox.to(email).at(-1)!.text)![1]!;
  await t.app.identity.activateAccount(anonymous(), { token, password: PASSWORD });
  return t.signInAs(email, PASSWORD);
}

const idOf = (actor: UserActor) => actor.activeScope!.id!;

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n");
  wardId = (await t.app.org.listWards())[0]!.id;
  a = await owner("enterprise", "0311111111", "a@example.vn", "Chủ thể A");
  b = await owner("enterprise", "0322222222", "b@example.vn", "Chủ thể B");
  household = await owner("household", "079200001234", "ho@example.vn", "Hộ C");
  admin = await t.signInAs(ADMIN.email, ADMIN.password);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("#14 Phạm vi of Chủ thể data (L01, stories 76, 80, 83)", () => {
  it("a Chủ thể reads its own organisation by id", async () => {
    expect(await t.app.entities.getEntity(a, { entityId: idOf(a) })).toMatchObject({ id: idOf(a), name: "Chủ thể A" });
  });

  it("a Chủ thể reading another Chủ thể by id gets not found, as for an id that does not exist", async () => {
    await expect(t.app.entities.getEntity(a, { entityId: idOf(b) })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.entities.getEntity(a, { entityId: "019a0000-0000-7000-8000-000000000000" })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.entities.getEntity(a, { entityId: "not-an-id" })).rejects.toMatchObject({ code: "not_found" });
  });

  it("a Chủ thể's list holds only itself", async () => {
    expect((await t.app.entities.listEntities(a)).map((e) => e.id)).toEqual([idOf(a)]);
    expect((await t.app.entities.listEntities(b)).map((e) => e.id)).toEqual([idOf(b)]);
  });

  it("Quản trị does not see Chủ thể at all", async () => {
    await expect(t.app.entities.listEntities(admin)).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.entities.getEntity(admin, { entityId: idOf(a) })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("a visitor without a session sees nothing", async () => {
    await expect(t.app.entities.getEntity(anonymous(), { entityId: idOf(a) })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("a hộ sản xuất sees its own số định danh in full (story 13)", async () => {
    expect(await t.app.entities.getEntity(household, { entityId: idOf(household) })).toMatchObject({
      kind: "household",
      identifier: "079200001234",
    });
  });

  it("the số định danh cá nhân is never stored readable (NĐ 13/2023)", async () => {
    const leaked = await db.admin.query("SELECT count(*)::int AS n FROM entity.entity e WHERE row_to_json(e)::text LIKE '%079200001234%'");
    expect(leaked.rows[0]).toEqual({ n: 0 });
  });
});
