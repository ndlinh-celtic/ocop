import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "./fixtures";

/*
 * L07 (#44, spec #30): the rounds module's gate "số hồ sơ chưa xong của đợt" counts the real hồ sơ of the
 * đợt. A đợt ends only once each hồ sơ submitted into it is in a finished state; Đã chuyển tỉnh is not.
 */

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
  t.clock.set(new Date("2026-10-19T02:00:00Z"));
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("L07 kết thúc đợt with hồ sơ chưa xong (spec #30)", () => {
  it("is refused while a hồ sơ of the đợt is not in a finished state, Đã chuyển tỉnh included, and allowed once all are", async () => {
    const { versionId, sets } = await f.publishedVersion("26/2026/QĐ-TTg");
    const roundId = await f.openRound(versionId);
    const sở = await f.staff("province_officer");
    const xã = await f.staff("ward_officer", wardId);
    const setId = sets["Rau củ quả"];

    const pending = await f.submitted(setId);
    const up = await f.forwarded(xã, setId);
    const gone = await f.submitted(setId);
    await t.app.dossiers.withdraw(gone.a, { dossierId: gone.dossierId, expectedVersion: gone.version, reason: "Rút" });
    const draft = await f.verifiedOwner();
    await t.app.dossiers.create(draft, { criteriaSetId: setId });

    t.clock.set(new Date("2026-12-01T02:00:00Z"));
    await t.app.rounds.closeDueSubmissions(systemActor("rounds.close-due"));
    await expect(t.app.rounds.endRound(sở, { roundId })).rejects.toMatchObject({ code: "round_has_unfinished_dossiers", message: expect.stringContaining("Còn 2 hồ sơ") });

    await t.app.dossiers.reject(xã, { dossierId: pending.dossierId, expectedVersion: pending.version, reasonCode: "other", explanation: "Không đủ điều kiện" });
    await expect(t.app.rounds.endRound(sở, { roundId })).rejects.toMatchObject({ code: "round_has_unfinished_dossiers", message: expect.stringContaining("Còn 1 hồ sơ") });

    const { version } = await t.app.dossiers.returnFromProvince(sở, { dossierId: up.dossierId, expectedVersion: up.version, deadline: "2026-12-05", items: [{ content: "Bổ sung" }] });
    await expect(t.app.rounds.endRound(sở, { roundId })).rejects.toMatchObject({ code: "round_has_unfinished_dossiers" });
    t.clock.set(new Date("2026-12-06T02:00:00Z"));
    await t.app.dossiers.closeUnsupplemented(xã, { dossierId: up.dossierId, expectedVersion: version });

    await expect(t.app.rounds.endRound(sở, { roundId })).resolves.toBeUndefined();
    expect(await t.app.rounds.getRound(sở, { roundId })).toMatchObject({ status: "ended" });
  });
});
