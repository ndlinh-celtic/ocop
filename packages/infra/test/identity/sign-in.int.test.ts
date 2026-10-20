import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonymous, createTestApp, createTestDatabase, requestContext, systemActor, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;

beforeAll(async () => {
  db = await createTestDatabase();
  // Password step only; TOTP has its own tests.
  t = createTestApp(db, { totpRequired: false });
});
afterAll(() => db.drop());

const ADMIN = { email: "Admin@Tinh.gov.vn", fullName: "Nguyễn Văn Quản", password: "mat-khau-du-dai-1" };

describe("L20 AD-01 first admin and password sign-in", () => {
  it("creates the first Quản trị once; a second bootstrap is refused", async () => {
    await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
    await expect(
      t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), { ...ADMIN, email: "other@tinh.gov.vn" }),
    ).rejects.toMatchObject({ code: "admin_already_exists" });
  });

  it("signs in with email in any letter case and the right password, and the session authenticates", async () => {
    const result = await t.app.identity.signIn(anonymous(), { email: "admin@tinh.gov.vn", password: ADMIN.password });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const actor = await t.app.identity.authenticate(anonymous(), { sessionToken: result.sessionToken });
    expect(actor).toMatchObject({ kind: "user", fullName: ADMIN.fullName, activeRole: "admin" });
  });

  it("rejects a wrong password and an unknown email with the same reason", async () => {
    const wrong = await t.app.identity.signIn(anonymous(), { email: ADMIN.email, password: "sai-mat-khau-roi" });
    const unknown = await t.app.identity.signIn(anonymous(), { email: "nobody@tinh.gov.vn", password: ADMIN.password });
    expect(wrong).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(unknown).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("does not authenticate a made-up token", async () => {
    await expect(t.app.identity.authenticate(anonymous(), { sessionToken: "not-a-real-token" })).resolves.toBeNull();
  });

  it("signing out revokes the session", async () => {
    const result = await t.app.identity.signIn(anonymous(), { email: ADMIN.email, password: ADMIN.password });
    if (!result.ok) throw new Error("sign-in failed");
    const actor = await t.app.identity.authenticate(anonymous(), { sessionToken: result.sessionToken });
    await t.app.identity.signOut(actor!);
    await expect(t.app.identity.authenticate(anonymous(), { sessionToken: result.sessionToken })).resolves.toBeNull();
  });
});

describe("L21 AD-08 audit of sign-in", () => {
  it("records successful and failed sign-ins, with who, what and when", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const entries = await t.app.audit.search(admin, { action: ["auth.sign_in.succeeded", "auth.sign_in.failed"] });
    const actions = entries.map((e) => e.action);
    expect(actions).toContain("auth.sign_in.succeeded");
    expect(actions).toContain("auth.sign_in.failed");
    const failedUnknown = entries.find((e) => e.action === "auth.sign_in.failed" && e.metadata.email === "nobody@tinh.gov.vn");
    expect(failedUnknown).toMatchObject({ actorUserId: null, targetId: null });
    const failedWrong = entries.find((e) => e.action === "auth.sign_in.failed" && e.metadata.email === "admin@tinh.gov.vn");
    expect(failedWrong).toMatchObject({ targetType: "user" });
    expect(entries.every((e) => e.occurredAt instanceof Date && e.requestId)).toBe(true);
  });

  it("the app database role can append audit rows but never change or delete them", async () => {
    await expect(db.app.query("UPDATE platform.audit_log SET action = 'x'")).rejects.toThrow();
    await expect(db.app.query("DELETE FROM platform.audit_log")).rejects.toThrow();
    await expect(db.app.query("TRUNCATE platform.audit_log")).rejects.toThrow();
  });

  it("even the table owner cannot rewrite audit rows: a trigger blocks it", async () => {
    const owner = await import("pg").then((pg) => new pg.default.Pool({ connectionString: db.url("migrator"), max: 1 }));
    try {
      await expect(owner.query("UPDATE platform.audit_log SET action = 'x'")).rejects.toThrow(/append-only/);
      await expect(owner.query("DELETE FROM platform.audit_log")).rejects.toThrow(/append-only/);
    } finally {
      await owner.end();
    }
  });

  it("only a Quản trị can search the audit log", async () => {
    const anonymousLike = { kind: "anonymous" as const, ctx: requestContext() };
    await expect(t.app.audit.search(anonymousLike, {})).rejects.toMatchObject({ code: "forbidden" });
  });
});
