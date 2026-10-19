import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, createTestDatabase, hours, requestContext, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const OFFICER = { email: "canbo.xa@tinh.gov.vn", fullName: "Trần Thị Xã" };

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(ADMIN, requestContext());
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

const linkToken = (text: string) => /kich-hoat\?token=([\w-]+)/.exec(text)?.[1];

describe("L20 AD-01 Quản trị creates staff accounts", () => {
  let officerId: string;
  let firstToken: string;

  it("only a Quản trị can create an account", async () => {
    await expect(
      t.app.identity.createStaffUser({ kind: "anonymous", ctx: requestContext() }, OFFICER),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("a new account is pending until activated and the officer gets an activation email", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    ({ userId: officerId } = await t.app.identity.createStaffUser(admin, OFFICER));
    await t.drainJobs();

    const mail = t.mailbox.to(OFFICER.email);
    expect(mail).toHaveLength(1);
    expect(mail[0]!.subject).toMatch(/Kích hoạt tài khoản/);
    expect(mail[0]!.text).toContain(OFFICER.fullName);
    firstToken = linkToken(mail[0]!.text)!;
    expect(firstToken).toBeTruthy();

    const users = await t.app.identity.listUsers(admin);
    expect(users.find((u) => u.id === officerId)).toMatchObject({ status: "pending_activation" });
  });

  it("refuses a second account with the same email, in any letter case", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    await expect(t.app.identity.createStaffUser(admin, { ...OFFICER, email: OFFICER.email.toUpperCase() })).rejects.toMatchObject({
      code: "email_taken",
    });
  });

  it("the activation event is delivered once even if the relay and the worker run again", async () => {
    await t.drainJobs();
    await t.drainJobs();
    expect(t.mailbox.to(OFFICER.email)).toHaveLength(1);
  });

  it("resending the link invalidates the previous one", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    await t.app.identity.resendActivation(admin, officerId);
    await t.drainJobs();
    const mail = t.mailbox.to(OFFICER.email);
    expect(mail).toHaveLength(2);
    const secondToken = linkToken(mail[1]!.text)!;
    expect(secondToken).not.toBe(firstToken);

    await expect(t.app.identity.activateAccount({ token: firstToken, password: "mat-khau-can-bo-1" }, requestContext())).resolves.toEqual({
      ok: false,
      reason: "invalid_link",
    });
    firstToken = secondToken;
  });

  it("rejects a password that is too short", async () => {
    await expect(t.app.identity.activateAccount({ token: firstToken, password: "ngan" }, requestContext())).rejects.toMatchObject({
      code: "password_too_short",
    });
  });

  it("the officer sets a password with the link, then signs in", async () => {
    await expect(t.app.identity.describeActivation(firstToken)).resolves.toMatchObject({ fullName: OFFICER.fullName });
    await expect(t.app.identity.activateAccount({ token: firstToken, password: "mat-khau-can-bo-1" }, requestContext())).resolves.toEqual({
      ok: true,
    });
    const officer = await t.signInAs(OFFICER.email, "mat-khau-can-bo-1");
    expect(officer.userId).toBe(officerId);
  });

  it("a used link cannot be used again", async () => {
    await expect(t.app.identity.activateAccount({ token: firstToken, password: "mat-khau-khac-123" }, requestContext())).resolves.toEqual({
      ok: false,
      reason: "invalid_link",
    });
  });

  it("a link expires after 72 hours", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    await t.app.identity.createStaffUser(admin, { email: "cham@tinh.gov.vn", fullName: "Lê Văn Chậm" });
    await t.drainJobs();
    const token = linkToken(t.mailbox.to("cham@tinh.gov.vn")[0]!.text)!;
    t.clock.advance(hours(72) + 1000);
    await expect(t.app.identity.activateAccount({ token, password: "mat-khau-can-bo-2" }, requestContext())).resolves.toEqual({
      ok: false,
      reason: "invalid_link",
    });
  });

  it("audits creation, link issue and activation without storing the link", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const entries = await t.app.audit.search(admin, { targetId: officerId });
    expect(entries.map((e) => e.action)).toEqual(
      expect.arrayContaining(["identity.user.created", "identity.activation.issued", "identity.user.activated"]),
    );
    expect(JSON.stringify(entries)).not.toContain(firstToken);
  });
});

describe("ADR 0001 outbox", () => {
  it("an event exists only if the use case committed", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const before = t.mailbox.all().length;
    await expect(t.app.identity.createStaffUser(admin, { email: ADMIN.email, fullName: "Trùng" })).rejects.toMatchObject({
      code: "email_taken",
    });
    await t.drainJobs();
    expect(t.mailbox.all().length).toBe(before);
  });

  it("a failed delivery is retried and the outcome recorded", async () => {
    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    t.mailbox.failNext(1);
    await t.app.identity.createStaffUser(admin, { email: "thu.lai@tinh.gov.vn", fullName: "Phạm Thử Lại" });
    await t.drainJobs();
    expect(t.mailbox.to("thu.lai@tinh.gov.vn")).toHaveLength(0);
    await t.drainJobs({ includeRetries: true });
    expect(t.mailbox.to("thu.lai@tinh.gov.vn")).toHaveLength(1);
    const deliveries = await t.app.notifications.listDeliveries(admin, { to: "thu.lai@tinh.gov.vn" });
    expect(deliveries.map((d) => d.status)).toEqual(["failed", "sent"]);
  });
});
