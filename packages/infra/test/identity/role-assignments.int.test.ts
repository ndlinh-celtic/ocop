import { ROLES, type Role } from "@ocop/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, minutes, requestContext, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const PASSWORD = "mat-khau-can-bo-1";
const WARDS_CSV = "ma,ten\n00001,Phường Mẫu Một\n00004,Xã Mẫu Bốn\n";

let wardId: string;
let otherWardId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(ADMIN, requestContext());
  await seedWards(db.app, WARDS_CSV);
  const wards = await t.app.org.listWards();
  wardId = wards.find((w) => w.code === "00001")!.id;
  otherWardId = wards.find((w) => w.code === "00004")!.id;
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

/** Creates an officer through the real flow and returns their id. */
async function activeOfficer(email: string, fullName: string) {
  const admin = await t.signInAs(ADMIN.email, ADMIN.password);
  const { userId } = await t.app.identity.createStaffUser(admin, { email, fullName });
  await t.drainJobs();
  const token = /kich-hoat\?token=([\w-]+)/.exec(t.mailbox.to(email).at(-1)!.text)![1]!;
  await t.app.identity.activateAccount({ token, password: PASSWORD }, requestContext());
  return userId;
}

describe("AD-06 ward catalogue seed", () => {
  it("is idempotent and keyed by the administrative code", async () => {
    await seedWards(db.app, "ma,ten\n00001,Phường Mẫu Một (đổi tên)\n00007,Xã Mẫu Bảy\n");
    const wards = await t.app.org.listWards();
    expect(wards.map((w) => w.code)).toEqual(["00001", "00004", "00007"]);
    expect(wards.find((w) => w.code === "00001")).toMatchObject({ id: wardId, name: "Phường Mẫu Một (đổi tên)" });
  });
});

describe("L20 AD-01 Phân vai", () => {
  let officerId: string;
  let assignmentId: string;

  it("grants Cán bộ xã on a ward; the officer is notified by email and in the app", async () => {
    officerId = await activeOfficer("xa@tinh.gov.vn", "Trần Thị Xã");
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    ({ assignmentId } = await t.app.identity.grantRole(admin, { userId: officerId, role: "ward_officer", scopeId: wardId }));
    await t.drainJobs();

    expect(t.mailbox.to("xa@tinh.gov.vn").at(-1)!.subject).toMatch(/phân vai/i);
    const officer = await t.signInAs("xa@tinh.gov.vn", PASSWORD);
    expect(officer).toMatchObject({ activeRole: "ward_officer", activeScope: { type: "ward", id: wardId } });
    await expect(t.app.notifications.unreadCount(officer)).resolves.toBe(1);
    const [n] = await t.app.notifications.list(officer);
    expect(n).toMatchObject({ title: expect.stringMatching(/Cán bộ xã/), readAt: null });
    await t.app.notifications.markRead(officer, n!.id);
    await expect(t.app.notifications.unreadCount(officer)).resolves.toBe(0);
  });

  it("a Người dùng only sees their own notifications", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const officer = await t.signInAs("xa@tinh.gov.vn", PASSWORD);
    const [n] = await t.app.notifications.list(officer);
    await expect(t.app.notifications.markRead(admin, n!.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.notifications.list(admin)).resolves.toEqual([]);
  });

  it("refuses a Phạm vi that does not fit the Vai trò", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    await expect(t.app.identity.grantRole(admin, { userId: officerId, role: "ward_officer", scopeId: null })).rejects.toMatchObject({
      code: "scope_required",
    });
    await expect(t.app.identity.grantRole(admin, { userId: officerId, role: "province_officer", scopeId: wardId })).rejects.toMatchObject({
      code: "scope_mismatch",
    });
    await expect(
      t.app.identity.grantRole(admin, { userId: officerId, role: "ward_officer", scopeId: "01a00000-0000-7000-8000-000000000000" }),
    ).rejects.toMatchObject({ code: "scope_not_found" });
  });

  it("refuses the same Phân vai twice while it is active", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    await expect(t.app.identity.grantRole(admin, { userId: officerId, role: "ward_officer", scopeId: wardId })).rejects.toMatchObject({
      code: "already_assigned",
    });
  });

  it("a Phân vai with a start date in the future is not active yet", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const later = await activeOfficer("sau@tinh.gov.vn", "Ngô Văn Sau");
    await t.app.identity.grantRole(admin, { userId: later, role: "ward_officer", scopeId: otherWardId, validFrom: new Date(t.clock.now().getTime() + minutes(60)) });
    const user = await t.signInAs("sau@tinh.gov.vn", PASSWORD);
    expect(user.activeRole).toBeNull();
  });

  it("revoking ends the Phân vai and signs the Người dùng out everywhere", async () => {
    const { token } = await t.signInWithToken("xa@tinh.gov.vn", PASSWORD);
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    t.clock.advance(minutes(1));
    await t.app.identity.revokeRole(admin, assignmentId);

    await expect(t.app.identity.authenticate(token, requestContext())).resolves.toBeNull();
    const again = await t.signInAs("xa@tinh.gov.vn", PASSWORD);
    expect(again.activeRole).toBeNull();
    const users = await t.app.identity.listUsers(admin);
    const row = users.find((u) => u.id === officerId)!;
    expect(row.assignments).toEqual([expect.objectContaining({ role: "ward_officer", active: false })]);
  });

  it("granting a Vai trò that needs TOTP to someone without it signs them out, so the next sign-in enrols", async () => {
    const strict = createTestApp(db, { totpRequired: true, clock: t.clock });
    const userId = await activeOfficer("so@tinh.gov.vn", "Đỗ Thị Sở");
    const before = await strict.app.identity.signIn({ email: "so@tinh.gov.vn", password: PASSWORD }, requestContext());
    expect(before).toMatchObject({ stage: "full" });
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    // The flag is a deployment setting shared by every process, so grant through the strict app too.
    await strict.app.identity.grantRole(admin, { userId, role: "province_officer", scopeId: null });
    if (!before.ok) throw new Error();
    await expect(strict.app.identity.authenticate(before.sessionToken, requestContext())).resolves.toBeNull();
    const after = await strict.app.identity.signIn({ email: "so@tinh.gov.vn", password: PASSWORD }, requestContext());
    expect(after).toMatchObject({ stage: "totp_enrollment" });
  });

  it("audits grant and revoke with before and after values", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const entries = await t.app.audit.search(admin, { targetId: assignmentId });
    expect(entries.map((e) => e.action).sort()).toEqual(["identity.role.granted", "identity.role.revoked"]);
    const revoked = entries.find((e) => e.action === "identity.role.revoked")!;
    expect(revoked.before).toMatchObject({ validTo: null });
    expect(revoked.after).toMatchObject({ validTo: expect.any(String) });
  });
});

describe("policy table for step 1 actions", () => {
  // Expected values written out from the spec, not derived from the policy itself.
  const ADMIN_ONLY = ["user.create", "user.list", "user.resend_activation", "role.grant", "role.revoke", "audit.search", "delivery.list"] as const;

  it.each(ROLES.map((r) => [r]))("%s", async (role: Role) => {
    const { can } = await import("@ocop/core");
    const actor = { kind: "user" as const, activeRole: role };
    for (const action of ADMIN_ONLY) expect(can(actor, action)).toBe(role === "admin");
    expect(can(actor, "notification.read_own")).toBe(true);
  });

  it("an anonymous visitor can do none of them", async () => {
    const { can } = await import("@ocop/core");
    for (const action of [...ADMIN_ONLY, "notification.read_own"] as const) expect(can({ kind: "anonymous" }, action)).toBe(false);
  });

  it("a signed-in Người dùng with no Vai trò đang dùng can only read their notifications", async () => {
    const { can } = await import("@ocop/core");
    expect(can({ kind: "user", activeRole: null }, "user.list")).toBe(false);
    expect(can({ kind: "user", activeRole: null }, "notification.read_own")).toBe(true);
  });
});
