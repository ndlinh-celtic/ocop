import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedWards } from "../../src/seed/wards";
import { anonymous, createTestApp, createTestDatabase, hours, systemActor, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
let wardId: string;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const PASSWORD = "mat-khau-chu-the-1";

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n00002,Phường Mẫu Hai\n");
  wardId = (await t.app.org.listWards())[0]!.id;
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

let ipCounter = 0;
/** Each registration from its own address, so the rate limit only bites where a test means it to. */
const visitor = () => anonymous({ ip: `198.51.100.${++ipCounter}` });

const linkToken = (text: string) => /kich-hoat\?token=([\w-]+)/.exec(text)?.[1];

const form = (over: Record<string, string> = {}) => ({
  kind: "enterprise" as const,
  name: "Công ty TNHH Mắm Bà Sáu",
  identifier: "0312456891",
  address: "Ấp 3, xã An Phú",
  representativeName: "Nguyễn Thị Sáu",
  phone: "0918452247",
  email: "sau.nguyen@example.vn",
  wardId,
  ...over,
});

/** Registers, follows the emailed link and signs in as the new Chủ thể. */
async function registerAndActivate(input: ReturnType<typeof form>) {
  await t.app.entities.register(visitor(), input);
  await t.drainJobs();
  const token = linkToken(t.mailbox.to(input.email).at(-1)!.text)!;
  const activated = await t.app.identity.activateAccount(anonymous(), { token, password: PASSWORD });
  expect(activated).toMatchObject({ ok: true, stage: "full" });
  return t.signInAs(input.email, PASSWORD);
}

describe("L01 CT-01 Chủ thể self-registration", () => {
  it("registers, activates by email and signs in as Chủ thể seeing its own organisation", async () => {
    const input = form();
    const owner = await registerAndActivate(input);

    expect(owner).toMatchObject({ activeRole: "entity_owner", activeScope: { type: "entity" } });
    const entityId = owner.activeScope!.id!;
    expect(await t.app.entities.getEntity(owner, { entityId })).toMatchObject({
      id: entityId,
      kind: "enterprise",
      name: input.name,
      identifier: "0312456891",
      address: input.address,
      representativeName: input.representativeName,
      phone: input.phone,
      ward: { id: wardId, name: "Xã An Phú" },
    });
  });

  it("labels the Chủ thể's Phạm vi with its name, as the shell shows it", async () => {
    const input = form({ name: "Hợp tác xã Bưởi An Phú", identifier: "0312000009", email: "htx.buoi@example.vn" });
    const owner = await registerAndActivate(input);
    expect((await t.app.identity.myAssignments(owner)).map((a) => [a.role, a.scopeLabel])).toEqual([["entity_owner", "Hợp tác xã Bưởi An Phú"]]);
  });

  it("checks the identifier against the Loại tổ chức: 10 or 13 digit mã số thuế, 12 digit số định danh for a hộ", async () => {
    await expect(t.app.entities.register(visitor(), form({ identifier: "12345" }))).rejects.toMatchObject({ code: "identifier_invalid" });
    await expect(t.app.entities.register(visitor(), form({ kind: "household", identifier: "0312456891" }))).rejects.toMatchObject({
      code: "identifier_invalid",
    });
    await expect(t.app.entities.register(visitor(), form({ email: "not-an-email" }))).rejects.toMatchObject({ code: "email_invalid" });
  });

  it("audits the registration and writes entity.registered to the outbox", async () => {
    const input = form({ identifier: "0312000001", email: "trail@example.vn" });
    const owner = await registerAndActivate(input);
    const entityId = owner.activeScope!.id!;

    const admin = await t.signInAs(ADMIN.email, ADMIN.password);
    const [entry] = await t.app.audit.search(admin, { action: ["entity.registered"], targetId: entityId });
    expect(entry).toMatchObject({ actorUserId: owner.userId, targetType: "entity", after: { kind: "enterprise", name: input.name, wardId } });
    const outbox = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'entity.registered' AND payload->>'entityId' = $1", [
      entityId,
    ]);
    expect(outbox.rows).toEqual([{ payload: { entityId, userId: owner.userId } }]);
  });
});

describe("L01 CT-01 duplicate Chủ thể (stories 3, 4)", () => {
  const FIRST = { identifier: "0312999888", email: "first.owner@example.vn", name: "Công ty TNHH Mắm Bà Sáu" };

  beforeAll(async () => {
    await t.app.entities.register(visitor(), form(FIRST));
  });

  const refusal = async (input: ReturnType<typeof form>) => {
    const err = await t.app.entities.register(visitor(), input).then(
      () => null,
      (e: unknown) => e as { code: string; message: string },
    );
    expect(err).not.toBeNull();
    return { code: err!.code, message: err!.message };
  };

  it("a taken mã số thuế, written with blanks and dashes, and a taken email get the same neutral refusal", async () => {
    const sameIdentifier = await refusal(form({ identifier: " 0312-999 888 ", email: "someone.else@example.vn" }));
    const sameEmail = await refusal(form({ identifier: "0312777666", email: "FIRST.OWNER@example.vn" }));

    expect(sameIdentifier.code).toBe("registration_conflict");
    expect(sameEmail).toEqual(sameIdentifier);
    expect(sameIdentifier.message).toMatch(/Cán bộ xã/);
    expect(sameIdentifier.message).not.toContain(FIRST.email);
    expect(sameIdentifier.message).not.toContain(FIRST.name);
  });

  it("a refused registration creates nothing: no account, no activation email", async () => {
    await t.drainJobs();
    expect(t.mailbox.to("someone.else@example.vn")).toHaveLength(0);
    // The identifier it tried is still free for its rightful owner.
    await expect(t.app.entities.register(visitor(), form({ identifier: "0312777666", email: "rightful@example.vn" }))).resolves.toBeUndefined();
  });

  it("a hộ sản xuất's số định danh is unique too", async () => {
    const household = form({ kind: "household", identifier: "079123456789", email: "ho.a@example.vn" });
    await t.app.entities.register(visitor(), household);
    expect((await refusal(form({ kind: "household", identifier: "079 123 456 789", email: "ho.b@example.vn" }))).code).toBe("registration_conflict");
  });
});

describe("L01 CT-01 registration rate limit", () => {
  it("refuses a sixth attempt from one address within the hour, counting failed ones, then lets it through after the window", async () => {
    const sameAddress = () => anonymous({ ip: "192.0.2.77" });
    for (let i = 0; i < 5; i++) {
      // Each one is refused for its own reason (no such ward), yet still counts.
      await expect(t.app.entities.register(sameAddress(), form({ wardId: "not-a-ward" }))).rejects.toMatchObject({ code: "ward_required" });
    }
    const input = form({ identifier: "0312555444", email: "rate@example.vn" });
    await expect(t.app.entities.register(sameAddress(), input)).rejects.toMatchObject({ code: "rate_limited" });
    // Another address is not affected.
    await expect(t.app.entities.register(visitor(), form({ identifier: "0312555433", email: "rate.other@example.vn" }))).resolves.toBeUndefined();

    t.clock.advance(hours(1) + 1);
    await expect(t.app.entities.register(sameAddress(), input)).resolves.toBeUndefined();
  });
});
