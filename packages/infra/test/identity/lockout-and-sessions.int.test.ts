import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedWards } from "../../src/seed/wards";
import { anonymous, createTestApp, createTestDatabase, hours, minutes, systemActor, type TestApp, type TestDatabase, totpCode } from "../support";

let db: TestDatabase;
let t: TestApp;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const PASSWORD = "mat-khau-can-bo-1";
let wardId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Phường Mẫu Một\n");
  wardId = (await t.app.org.listWards())[0]!.id;
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

/** Token from the newest email to `email` that links to `path`. */
const link = (email: string, path: string) => {
  const re = new RegExp(`${path}\\?token=([\\w-]+)`);
  const mail = t.mailbox.to(email).findLast((m) => re.test(m.text));
  return mail ? re.exec(mail.text)?.[1] : undefined;
};

async function officer(email: string, role: "ward_officer" | "province_officer" = "ward_officer") {
  const admin = await t.signInAs(ADMIN.email, ADMIN.password);
  const { userId } = await t.app.identity.createStaffUser(admin, { email, fullName: `Cán bộ ${email}` });
  await t.app.identity.grantRole(admin, { userId, role, scopeId: role === "ward_officer" ? wardId : null });
  await t.drainJobs();
  await t.app.identity.activateAccount(anonymous(), { token: link(email, "kich-hoat")!, password: PASSWORD });
  return userId;
}

const wrong = (email: string) => t.app.identity.signIn(anonymous(), { email, password: "sai-mat-khau-day" });

describe("L20 temporary lockout", () => {
  it("5 wrong passwords within 15 minutes lock the account for 15 minutes and email the owner", async () => {
    await officer("khoa@tinh.gov.vn");
    for (let i = 0; i < 4; i++) {
      await expect(wrong("khoa@tinh.gov.vn")).resolves.toEqual({ ok: false, reason: "invalid_credentials" });
      t.clock.advance(minutes(2));
    }
    await expect(wrong("khoa@tinh.gov.vn")).resolves.toMatchObject({ ok: false, reason: "locked" });
    await expect(t.app.identity.signIn(anonymous(), { email: "khoa@tinh.gov.vn", password: PASSWORD })).resolves.toMatchObject({
      ok: false,
      reason: "locked",
    });
    await t.drainJobs();
    expect(t.mailbox.to("khoa@tinh.gov.vn").at(-1)!.subject).toMatch(/tạm khóa/i);

    t.clock.advance(minutes(15) + 1000);
    await expect(t.app.identity.signIn(anonymous(), { email: "khoa@tinh.gov.vn", password: PASSWORD })).resolves.toMatchObject({ ok: true });
  });

  it("failures spread over more than 15 minutes do not lock", async () => {
    await officer("cham@tinh.gov.vn");
    for (let i = 0; i < 6; i++) {
      await wrong("cham@tinh.gov.vn");
      t.clock.advance(minutes(4));
    }
    await expect(t.app.identity.signIn(anonymous(), { email: "cham@tinh.gov.vn", password: PASSWORD })).resolves.toMatchObject({ ok: true });
  });

  it("a successful sign-in resets the count", async () => {
    await officer("reset@tinh.gov.vn");
    for (let i = 0; i < 4; i++) await wrong("reset@tinh.gov.vn");
    await t.signInAs("reset@tinh.gov.vn", PASSWORD);
    for (let i = 0; i < 4; i++) await wrong("reset@tinh.gov.vn");
    await expect(t.app.identity.signIn(anonymous(), { email: "reset@tinh.gov.vn", password: PASSWORD })).resolves.toMatchObject({ ok: true });
  });

  it("wrong TOTP codes count towards the lockout too", async () => {
    const strict = createTestApp(db, { totpRequired: true, clock: t.clock });
    await officer("totp@tinh.gov.vn", "province_officer");
    const first = await strict.app.identity.signIn(anonymous(), { email: "totp@tinh.gov.vn", password: PASSWORD });
    if (!first.ok) throw new Error();
    const { secret } = await strict.app.identity.startTotpEnrollment(anonymous(), { sessionToken: first.sessionToken });
    await strict.app.identity.confirmTotpEnrollment(anonymous(), { sessionToken: first.sessionToken, code: await totpCode(secret, t.clock.now()) });

    t.clock.advance(minutes(1));
    const r = await strict.app.identity.signIn(anonymous(), { email: "totp@tinh.gov.vn", password: PASSWORD });
    if (!r.ok) throw new Error();
    for (let i = 0; i < 4; i++) await strict.app.identity.verifySignInTotp(anonymous(), { sessionToken: r.sessionToken, code: "000000" });
    await expect(strict.app.identity.verifySignInTotp(anonymous(), { sessionToken: r.sessionToken, code: "000000" })).resolves.toEqual({ ok: false, reason: "locked" });
    await expect(strict.app.identity.verifySignInTotp(anonymous(), { sessionToken: r.sessionToken, code: await totpCode(secret, t.clock.now()) })).resolves.toMatchObject({
      ok: false,
    });
  });

  it("Quản trị sees the account as locked", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    for (let i = 0; i < 5; i++) await wrong("reset@tinh.gov.vn");
    const row = (await t.app.identity.listUsers(admin)).find((u) => u.email === "reset@tinh.gov.vn")!;
    expect(row.lockedUntil).toBeInstanceOf(Date);
  });
});

describe("L20 session lifetime", () => {
  it("a Cán bộ xã session survives 7 hours idle but not 8", async () => {
    await officer("xa8h@tinh.gov.vn");
    const { token } = await t.signInWithToken("xa8h@tinh.gov.vn", PASSWORD);
    t.clock.advance(hours(7));
    await expect(t.app.identity.authenticate(anonymous(), { sessionToken: token })).resolves.not.toBeNull();
    t.clock.advance(hours(8) + 1000);
    await expect(t.app.identity.authenticate(anonymous(), { sessionToken: token })).resolves.toBeNull();
  });

  it("a session of a Vai trò that requires TOTP ends after 30 minutes idle; activity keeps it alive", async () => {
    await officer("so30@tinh.gov.vn", "province_officer");
    const { token } = await t.signInWithToken("so30@tinh.gov.vn", PASSWORD);
    t.clock.advance(minutes(25));
    await expect(t.app.identity.authenticate(anonymous(), { sessionToken: token })).resolves.not.toBeNull();
    t.clock.advance(minutes(25));
    await expect(t.app.identity.authenticate(anonymous(), { sessionToken: token })).resolves.not.toBeNull();
    t.clock.advance(minutes(30) + 1000);
    await expect(t.app.identity.authenticate(anonymous(), { sessionToken: token })).resolves.toBeNull();
  });

  it("no session lives longer than 12 hours, however active", async () => {
    const { token } = await t.signInWithToken("xa8h@tinh.gov.vn", PASSWORD);
    for (let h = 0; h < 12; h++) {
      t.clock.advance(hours(1));
      await t.app.identity.authenticate(anonymous(), { sessionToken: token });
    }
    t.clock.advance(1000);
    await expect(t.app.identity.authenticate(anonymous(), { sessionToken: token })).resolves.toBeNull();
  });
});

describe("L20 forgotten and changed passwords", () => {
  it("answers the same for unknown and known emails, and only emails known ones", async () => {
    const before = t.mailbox.all().length;
    await expect(t.app.identity.requestPasswordReset(anonymous(), { email: "khong-co@tinh.gov.vn" })).resolves.toBeUndefined();
    await expect(t.app.identity.requestPasswordReset(anonymous(), { email: "xa8h@tinh.gov.vn" })).resolves.toBeUndefined();
    await t.drainJobs();
    expect(t.mailbox.all().length).toBe(before + 1);
    expect(t.mailbox.to("xa8h@tinh.gov.vn").at(-1)!.subject).toMatch(/Đặt lại mật khẩu/);
  });

  it("the reset link sets a new password once, signs out every session and lifts a lockout", async () => {
    const { token: oldSession } = await t.signInWithToken("xa8h@tinh.gov.vn", PASSWORD);
    for (let i = 0; i < 5; i++) await wrong("xa8h@tinh.gov.vn");
    const resetToken = link("xa8h@tinh.gov.vn", "dat-lai-mat-khau")!;
    await expect(t.app.identity.resetPassword(anonymous(), { token: resetToken, password: "mat-khau-moi-123" })).resolves.toEqual({ ok: true });
    await expect(t.app.identity.resetPassword(anonymous(), { token: resetToken, password: "mat-khau-moi-456" })).resolves.toEqual({
      ok: false,
      reason: "invalid_link",
    });
    await expect(t.app.identity.authenticate(anonymous(), { sessionToken: oldSession })).resolves.toBeNull();
    await expect(t.signInAs("xa8h@tinh.gov.vn", "mat-khau-moi-123")).resolves.toMatchObject({ kind: "user" });
  });

  it("a reset link expires after an hour", async () => {
    await t.app.identity.requestPasswordReset(anonymous(), { email: "cham@tinh.gov.vn" });
    await t.drainJobs();
    const token = link("cham@tinh.gov.vn", "dat-lai-mat-khau")!;
    t.clock.advance(hours(1) + 1000);
    await expect(t.app.identity.resetPassword(anonymous(), { token, password: "mat-khau-moi-123" })).resolves.toEqual({
      ok: false,
      reason: "invalid_link",
    });
  });

  it("changing the password needs the current one and signs out the other sessions only", async () => {
    const other = await t.signInWithToken("cham@tinh.gov.vn", PASSWORD);
    const current = await t.signInWithToken("cham@tinh.gov.vn", PASSWORD);
    await expect(
      t.app.identity.changePassword(current.actor, { currentPassword: "khong-dung-dau", newPassword: "mat-khau-moi-789" }),
    ).rejects.toMatchObject({ code: "wrong_password" });
    await t.app.identity.changePassword(current.actor, { currentPassword: PASSWORD, newPassword: "mat-khau-moi-789" });
    await expect(t.app.identity.authenticate(anonymous(), { sessionToken: other.token })).resolves.toBeNull();
    await expect(t.app.identity.authenticate(anonymous(), { sessionToken: current.token })).resolves.not.toBeNull();
  });

  it("audits lockouts, resets and password changes", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const actions = new Set((await t.app.audit.search(admin, { limit: 1000 })).map((e) => e.action));
    for (const a of ["identity.user.locked", "identity.password.reset", "identity.password.changed", "identity.password_reset.requested"]) {
      expect(actions).toContain(a);
    }
  });
});
