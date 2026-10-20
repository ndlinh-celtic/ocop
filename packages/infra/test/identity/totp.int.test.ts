import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, createTestDatabase, minutes, requestContext, totpCode, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
let secret: string;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db);
  await t.app.identity.bootstrapFirstAdmin(ADMIN, requestContext());
});
afterAll(() => db.drop());

async function passwordStep() {
  const r = await t.app.identity.signIn({ email: ADMIN.email, password: ADMIN.password }, requestContext());
  if (!r.ok) throw new Error("password step failed");
  return r;
}

describe("L20 DC-09 TOTP for roles that require it", () => {

  it("a Quản trị without TOTP must enroll before the session is usable", async () => {
    const r = await passwordStep();
    expect(r.stage).toBe("totp_enrollment");
    await expect(t.app.identity.authenticate(r.sessionToken, requestContext())).resolves.toBeNull();

    const enrollment = await t.app.identity.startTotpEnrollment(r.sessionToken, requestContext());
    expect(enrollment.otpauthUri).toMatch(/^otpauth:\/\/totp\/.*admin%40tinh\.gov\.vn/);
    secret = enrollment.secret;

    await expect(t.app.identity.confirmTotpEnrollment(r.sessionToken, "000000", requestContext())).resolves.toEqual({
      ok: false,
      reason: "invalid_code",
    });
    const confirmed = await t.app.identity.confirmTotpEnrollment(r.sessionToken, await totpCode(secret, t.clock.now()), requestContext());
    expect(confirmed).toEqual({ ok: true });
    await expect(t.app.identity.authenticate(r.sessionToken, requestContext())).resolves.toMatchObject({ activeRole: "admin" });
  });

  it("after enrolling, sign-in asks for a code and only a valid one completes it", async () => {
    t.clock.advance(minutes(1));
    const r = await passwordStep();
    expect(r.stage).toBe("totp_pending");
    await expect(t.app.identity.authenticate(r.sessionToken, requestContext())).resolves.toBeNull();

    await expect(t.app.identity.verifySignInTotp(r.sessionToken, "123456", requestContext())).resolves.toEqual({
      ok: false,
      reason: "invalid_code",
    });
    const ok = await t.app.identity.verifySignInTotp(r.sessionToken, await totpCode(secret, t.clock.now()), requestContext());
    expect(ok).toEqual({ ok: true });
    await expect(t.app.identity.authenticate(r.sessionToken, requestContext())).resolves.toMatchObject({ kind: "user" });
  });

  it("a code that was already used cannot be used again", async () => {
    const code = await totpCode(secret, t.clock.now());
    const r = await passwordStep();
    await expect(t.app.identity.verifySignInTotp(r.sessionToken, code, requestContext())).resolves.toEqual({
      ok: false,
      reason: "invalid_code",
    });
  });

  it("an unfinished TOTP step expires after 5 minutes", async () => {
    t.clock.advance(minutes(1));
    const r = await passwordStep();
    t.clock.advance(minutes(5) + 1000);
    await expect(t.app.identity.verifySignInTotp(r.sessionToken, await totpCode(secret, t.clock.now()), requestContext())).resolves.toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("the TOTP secret is stored encrypted, never in clear", async () => {
    const { rows } = await db.admin.query("SELECT totp_secret_enc FROM identity.user_account WHERE email = $1", [ADMIN.email]);
    expect(rows[0].totp_secret_enc).toBeTruthy();
    expect(rows[0].totp_secret_enc).not.toContain(secret);
  });

  it("audits enrolment, failed codes and the completed sign-in", async () => {
    t.clock.advance(minutes(1));
    const admin = await t.signInAs(ADMIN.email, ADMIN.password, secret);
    const actions = (await t.app.audit.search(admin, {})).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["identity.totp.enrolled", "auth.totp.failed", "auth.sign_in.succeeded"]));
    const completed = (await t.app.audit.search(admin, { action: ["auth.sign_in.succeeded"] }))[0];
    expect(completed?.metadata).toMatchObject({ method: "password+totp" });
  });
});

describe("ADR 0003 deployment flag for mandatory TOTP", () => {
  it("with the flag off, a Quản trị without TOTP signs in with the password alone", async () => {
    const off = await createTestDatabase();
    try {
      const app = createTestApp(off, { totpRequired: false });
      await app.app.identity.bootstrapFirstAdmin(ADMIN, requestContext());
      const r = await app.app.identity.signIn({ email: ADMIN.email, password: ADMIN.password }, requestContext());
      expect(r).toMatchObject({ ok: true, stage: "full" });
    } finally {
      await off.drop();
    }
  });

  it("with the flag off, a Người dùng who turned TOTP on still has to enter a code", async () => {
    const off = await createTestDatabase();
    try {
      const app = createTestApp(off, { totpRequired: false });
      await app.app.identity.bootstrapFirstAdmin(ADMIN, requestContext());
      const first = await app.app.identity.signIn({ email: ADMIN.email, password: ADMIN.password }, requestContext());
      if (!first.ok) throw new Error("password step failed");
      const { secret: own } = await app.app.identity.startTotpEnrollment(first.sessionToken, requestContext());
      await expect(app.app.identity.confirmTotpEnrollment(first.sessionToken, await totpCode(own, app.clock.now()), requestContext())).resolves.toEqual({ ok: true });

      app.clock.advance(minutes(1));
      const next = await app.app.identity.signIn({ email: ADMIN.email, password: ADMIN.password }, requestContext());
      expect(next).toMatchObject({ ok: true, stage: "totp_pending" });
      if (!next.ok) throw new Error();
      await expect(app.app.identity.authenticate(next.sessionToken, requestContext())).resolves.toBeNull();
    } finally {
      await off.drop();
    }
  });

  it("records the flag value each time a process starts", async () => {
    await t.app.system.recordStartup("web", requestContext());
    t.clock.advance(minutes(1));
    const admin = await t.signInAs(ADMIN.email, ADMIN.password, secret);
    const [entry] = await t.app.audit.search(admin, { action: ["system.started"] });
    expect(entry?.metadata).toEqual({ process: "web", totpRequired: true });
  });
});
