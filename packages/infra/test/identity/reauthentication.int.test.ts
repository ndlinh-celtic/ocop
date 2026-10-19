import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, createTestDatabase, minutes, requestContext, totpCode, type TestApp, type TestDatabase } from "../support";

const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };

describe("L20 Xác thực lại with TOTP", () => {
  let db: TestDatabase;
  let t: TestApp;
  let secret: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    t = createTestApp(db, { totpRequired: true });
    await t.app.identity.bootstrapFirstAdmin(ADMIN, requestContext());
    const r = await t.app.identity.signIn({ email: ADMIN.email, password: ADMIN.password }, requestContext());
    if (!r.ok) throw new Error();
    ({ secret } = await t.app.identity.startTotpEnrollment(r.sessionToken, requestContext()));
    await t.app.identity.confirmTotpEnrollment(r.sessionToken, await totpCode(secret, t.clock.now()), requestContext());
  });
  afterAll(async () => {
    await t.stop();
    await db.drop();
  });

  it("a sensitive action right after sign-in goes through", async () => {
    t.clock.advance(minutes(1));
    const admin = await t.signInAs(ADMIN.email, ADMIN.password, secret);
    await expect(t.app.identity.sensitiveSample(admin)).resolves.toMatchObject({ method: "password+totp" });
  });

  it("after 5 minutes it asks for Xác thực lại, then goes through for another 5 minutes", async () => {
    t.clock.advance(minutes(1));
    const admin = await t.signInAs(ADMIN.email, ADMIN.password, secret);
    t.clock.advance(minutes(5) + 1000);
    await expect(t.app.identity.sensitiveSample(admin)).rejects.toMatchObject({ code: "reauth_required" });

    await expect(t.app.identity.reauthenticate(admin, { code: "000000" })).resolves.toEqual({ ok: false, reason: "invalid" });
    await expect(t.app.identity.reauthenticate(admin, { password: ADMIN.password })).resolves.toEqual({ ok: false, reason: "totp_required" });
    await expect(t.app.identity.reauthenticate(admin, { code: await totpCode(secret, t.clock.now()) })).resolves.toEqual({ ok: true });

    t.clock.advance(minutes(4));
    await expect(t.app.identity.sensitiveSample(admin)).resolves.toMatchObject({ method: "totp" });
    t.clock.advance(minutes(1) + 1000);
    await expect(t.app.identity.sensitiveSample(admin)).rejects.toMatchObject({ code: "reauth_required" });
  });

  it("the audit row of the sensitive action carries when and how the user re-authenticated", async () => {
    t.clock.advance(minutes(1));
    const admin = await t.signInAs(ADMIN.email, ADMIN.password, secret);
    const [entry] = await t.app.audit.search(admin, { action: ["identity.sensitive_sample"] });
    expect(entry!.metadata).toMatchObject({ reauth: { method: expect.stringMatching(/totp/), at: expect.any(String) } });
  });
});

describe("ADR 0003 Xác thực lại by password when TOTP is not mandatory", () => {
  let db: TestDatabase;
  let t: TestApp;

  beforeAll(async () => {
    db = await createTestDatabase();
    t = createTestApp(db, { totpRequired: false });
    await t.app.identity.bootstrapFirstAdmin(ADMIN, requestContext());
  });
  afterAll(async () => {
    await t.stop();
    await db.drop();
  });

  it("accepts the password and records the method as password", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    t.clock.advance(minutes(6));
    await expect(t.app.identity.sensitiveSample(admin)).rejects.toMatchObject({ code: "reauth_required" });
    await expect(t.app.identity.reauthenticate(admin, { password: "sai-mat-khau-roi" })).resolves.toEqual({ ok: false, reason: "invalid" });
    await expect(t.app.identity.reauthenticate(admin, { password: ADMIN.password })).resolves.toEqual({ ok: true });
    await expect(t.app.identity.sensitiveSample(admin)).resolves.toMatchObject({ method: "password" });
    const [entry] = await t.app.audit.search(admin, { action: ["identity.sensitive_sample"] });
    expect(entry!.metadata).toMatchObject({ reauth: { method: "password" } });
  });
});
