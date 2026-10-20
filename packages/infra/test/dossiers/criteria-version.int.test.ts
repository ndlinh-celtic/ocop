import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, minutes, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "./fixtures";

let db: TestDatabase;
let t: TestApp;
let wardId: string;
let f: ReturnType<typeof fixtures>;

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n");
  wardId = (await t.app.org.listWards())[0]!.id;
  f = fixtures(t, () => wardId);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("L02 CT-03 Phiên bản tiêu chí of a new hồ sơ (stories 16, 17)", () => {
  it("refuses to start a hồ sơ before any version is published", async () => {
    const a = await f.owner();
    await expect(t.app.dossiers.creationOptions(a)).rejects.toMatchObject({ code: "no_criteria_version" });
  });

  it("uses the version of the đợt Đang nhận nộp, even when a newer one is published, then the newest once Hạn nộp xã has passed", async () => {
    const roundVersion = await f.publishedVersion("01/2026/QĐ-UBND");
    const roundId = await f.openRound(roundVersion.versionId);
    t.clock.advance(minutes(5));
    const newer = await f.publishedVersion("02/2026/QĐ-UBND");
    const a = await f.verifiedOwner();

    expect(await t.app.dossiers.creationOptions(a)).toMatchObject({
      version: { id: roundVersion.versionId, legalBasis: "01/2026/QĐ-UBND" },
      round: { id: roundId },
      productGroups: [{ name: "Thực phẩm", subgroups: [{ name: "Thực phẩm tươi sống", sets: [{ name: "Rau củ quả" }, { name: "Thịt tươi" }] }] }],
    });
    await expect(t.app.dossiers.create(a, { criteriaSetId: newer.sets["Rau củ quả"] })).rejects.toMatchObject({ code: "criteria_set_not_applicable" });
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: roundVersion.sets["Rau củ quả"] });
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ criteriaVersion: { id: roundVersion.versionId } });

    t.clock.set(new Date("2026-12-01T00:00:00Z"));
    expect(await t.app.dossiers.creationOptions(a)).toMatchObject({ version: { id: newer.versionId }, round: null });
    await expect(t.app.dossiers.create(a, { criteriaSetId: roundVersion.sets["Thịt tươi"] })).rejects.toMatchObject({ code: "criteria_set_not_applicable" });
    await expect(t.app.dossiers.create(a, { criteriaSetId: newer.sets["Thịt tươi"] })).resolves.toMatchObject({ dossierId: expect.any(String) });
    // The hồ sơ created earlier keeps its Bộ tiêu chí.
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ criteriaVersion: { id: roundVersion.versionId } });
  });
});
