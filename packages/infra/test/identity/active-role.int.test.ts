import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, requestContext, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
let adminId: string;
let wardId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  ({ userId: adminId } = await t.app.identity.bootstrapFirstAdmin(ADMIN, requestContext()));
  await seedWards(db.app, "ma,ten\n00001,Phường Mẫu Một\n");
  wardId = (await t.app.org.listWards())[0]!.id;
  // The Quản trị also works as a Cán bộ xã: one person, two Phân vai.
  const admin = await t.signInAs(ADMIN.email, ADMIN.password);
  await t.app.identity.grantRole(admin, { userId: adminId, role: "ward_officer", scopeId: wardId });
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

/** Signs in and switches to the given Vai trò through the real use cases. */
async function signInAsRole(role: "admin" | "ward_officer") {
  const { actor, token } = await t.signInWithToken(ADMIN.email, ADMIN.password);
  const target = (await t.app.identity.myAssignments(actor)).find((a) => a.role === role)!;
  await t.app.identity.switchActiveRole(actor, target.id);
  return (await t.app.identity.authenticate(token, requestContext()))!;
}

describe("L20 Vai trò đang dùng", () => {
  it("with several active Phân vai, a new session has no Vai trò đang dùng until one is chosen", async () => {
    const actor = await t.signInAs(ADMIN.email, ADMIN.password);
    expect(actor.activeRole).toBeNull();
    const mine = await t.app.identity.myAssignments(actor);
    expect(mine.map((a) => [a.role, a.scopeLabel]).sort()).toEqual([
      ["admin", "Toàn hệ thống"],
      ["ward_officer", "Phường Mẫu Một"],
    ]);
  });

  it("the server checks the Vai trò đang dùng, not every Phân vai the person holds", async () => {
    const { actor, token } = await t.signInWithToken(ADMIN.email, ADMIN.password);
    const mine = await t.app.identity.myAssignments(actor);
    const ward = mine.find((a) => a.role === "ward_officer")!;
    const admin = mine.find((a) => a.role === "admin")!;

    await t.app.identity.switchActiveRole(actor, ward.id);
    const asWard = (await t.app.identity.authenticate(token, requestContext()))!;
    expect(asWard).toMatchObject({ activeRole: "ward_officer", activeScope: { type: "ward", id: wardId } });
    await expect(t.app.identity.listUsers(asWard)).rejects.toMatchObject({ code: "forbidden" });

    await t.app.identity.switchActiveRole(asWard, admin.id);
    const asAdmin = (await t.app.identity.authenticate(token, requestContext()))!;
    await expect(t.app.identity.listUsers(asAdmin)).resolves.toBeInstanceOf(Array);
  });

  it("refuses to switch to someone else's Phân vai or one that has ended", async () => {
    const asAdmin = await signInAsRole("admin");
    const { userId: otherId } = await t.app.identity.createStaffUser(asAdmin, { email: "khac@tinh.gov.vn", fullName: "Người Khác" });
    const { assignmentId } = await t.app.identity.grantRole(asAdmin, { userId: otherId, role: "ward_officer", scopeId: wardId });
    await expect(t.app.identity.switchActiveRole(asAdmin, assignmentId)).rejects.toMatchObject({ code: "not_found" });

    const ward = (await t.app.identity.myAssignments(asAdmin)).find((a) => a.role === "ward_officer")!;
    await t.app.identity.revokeRole(asAdmin, ward.id);
    const fresh = await t.signInAs(ADMIN.email, ADMIN.password);
    await expect(t.app.identity.switchActiveRole(fresh, ward.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("audits each switch", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const entries = await t.app.audit.search(admin, { action: ["auth.role.switched"] });
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries[0]!.metadata).toMatchObject({ toRole: expect.any(String) });
  });
});
