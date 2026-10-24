import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "./fixtures";

/*
 * L08 SO-02 (#51, spec #49 stories 12 to 19, 137): the Cán bộ Sở Tiếp nhận tại tỉnh a hồ sơ Đã chuyển
 * tỉnh, once per lượt gửi tỉnh. It is an event of the hồ sơ, not a state; the đợt must have a Hội đồng.
 */

let db: TestDatabase;
let t: TestApp;
let wardId: string;
let otherWardId: string;
let f: ReturnType<typeof fixtures>;
let sets: Record<"Rau củ quả" | "Thịt tươi", string>;
let roundId: string;
let ward: UserActor;
let otherWard: UserActor;
let province: UserActor;
const START = new Date("2026-10-19T02:00:00Z");
const RETURN = { deadline: "2026-10-31", items: [{ content: "Bổ sung phiếu kiểm nghiệm" }] };

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n00002,Xã Bình Lợi\n");
  const wards = await t.app.org.listWards();
  wardId = wards.find((w) => w.name === "Xã An Phú")!.id;
  otherWardId = wards.find((w) => w.name === "Xã Bình Lợi")!.id;
  f = fixtures(t, () => wardId);
  t.clock.set(START);
  const version = await f.publishedVersion("26/2026/QĐ-TTg", { productGroups: ["Thực phẩm", "Đồ uống"] });
  sets = version.sets;
  roundId = await f.openRound(version.versionId);
  ward = await f.staff("ward_officer", wardId);
  otherWard = await f.staff("ward_officer", otherWardId);
  province = await f.staff("province_officer");
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

const outboxCount = async (type: string, id: string) =>
  (await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = $1 AND payload->>'dossierId' = $2", [type, id])).rowCount;

/** Sở trả về, the Chủ thể nộp lại, the xã signs a new report and gửi tỉnh again: the next lượt gửi tỉnh. */
async function backAtProvince(up: { a: UserActor; dossierId: string }, version: number) {
  ({ version } = await t.app.dossiers.returnFromProvince(province, { dossierId: up.dossierId, expectedVersion: version, ...RETURN }));
  ({ version } = await t.app.dossiers.submit(up.a, { dossierId: up.dossierId, expectedVersion: version }));
  const fileId = await f.uploadPdf(ward, "signed_ward_report", "BC lần 2.pdf");
  ({ version } = await t.app.dossiers.attachSignedWardReport(ward, { dossierId: up.dossierId, expectedVersion: version, fileId }));
  return (await t.app.dossiers.forwardToProvince(ward, { dossierId: up.dossierId, expectedVersion: version })).version;
}

describe("L08 Tiếp nhận tại tỉnh needs a Hội đồng on the đợt (story 12)", () => {
  it("is refused with round_without_council until the Sở gán a Hội đồng to the đợt", async () => {
    const up = await f.forwarded(ward, sets["Rau củ quả"]);

    await expect(t.app.dossiers.receiveAtProvince(province, { dossierId: up.dossierId, expectedVersion: up.version })).rejects.toMatchObject({
      code: "round_without_council",
    });
    expect(await t.app.dossiers.get(province, { dossierId: up.dossierId })).toMatchObject({ provinceReceivedAt: null, version: up.version });

    await t.app.rounds.assignCouncil(province, { roundId, councilId: await f.council(province) });
    await expect(t.app.dossiers.receiveAtProvince(province, { dossierId: up.dossierId, expectedVersion: up.version })).resolves.toEqual({
      version: up.version + 1,
    });
  });
});

describe("L08 SO-02 Tiếp nhận tại tỉnh (stories 15, 16, 137)", () => {
  it("records when and by whom, keeps the state, is on the Chủ thể's timeline, with audit and outbox", async () => {
    const up = await f.forwarded(ward, sets["Rau củ quả"]);
    t.clock.set(new Date("2026-10-20T03:00:00Z"));

    const { version } = await t.app.dossiers.receiveAtProvince(province, { dossierId: up.dossierId, expectedVersion: up.version });

    const at = new Date("2026-10-20T03:00:00Z");
    expect(await t.app.dossiers.get(province, { dossierId: up.dossierId })).toMatchObject({
      state: "forwarded_to_province",
      version,
      provinceReceivedAt: at,
      provinceReceivedBy: province.userId,
      firstProvinceReceivedAt: at,
    });
    expect((await t.app.dossiers.timeline(up.a, { dossierId: up.dossierId })).at(-1)).toMatchObject({
      action: "dossier.province_receive",
      fromState: "forwarded_to_province",
      toState: "forwarded_to_province",
      actorUserId: province.userId,
      occurredAt: at,
    });
    const [entry] = await t.app.audit.search(await f.admin(), { action: ["dossier.province_receive"], targetId: up.dossierId });
    expect(entry).toMatchObject({ actorUserId: province.userId, actorRole: "province_officer", after: { state: "forwarded_to_province", version } });
    expect(await outboxCount("dossier.province_received", up.dossierId)).toBe(1);
  });

  it("is refused a second time in the same lượt gửi tỉnh, to anyone but the Cán bộ Sở, on a stale version and outside Đã chuyển tỉnh", async () => {
    const up = await f.forwarded(ward, sets["Rau củ quả"]);
    const receive = (actor: UserActor, expectedVersion = up.version) => t.app.dossiers.receiveAtProvince(actor, { dossierId: up.dossierId, expectedVersion });

    await expect(receive(ward)).rejects.toMatchObject({ code: "forbidden" });
    await expect(receive(up.a)).rejects.toMatchObject({ code: "forbidden" });
    await expect(receive(await f.admin())).rejects.toMatchObject({ code: "forbidden" });
    await expect(receive(province, up.version - 1)).rejects.toMatchObject({ code: "version_conflict" });
    const { version } = await receive(province);
    await expect(receive(province, version)).rejects.toMatchObject({ code: "already_province_received" });
    expect(await outboxCount("dossier.province_received", up.dossierId)).toBe(1);

    const down = await f.received(ward, sets["Rau củ quả"]);
    await expect(t.app.dossiers.receiveAtProvince(province, { dossierId: down.dossierId, expectedVersion: down.version })).rejects.toMatchObject({
      code: "not_found",
    });
    const { version: returned } = await t.app.dossiers.returnFromProvince(province, { dossierId: up.dossierId, expectedVersion: version, ...RETURN });
    await expect(receive(province, returned)).rejects.toMatchObject({ code: "invalid_state" });
  });
});

describe("L08 Chờ tiếp nhận and the lượt gửi tỉnh (stories 13, 17, 18)", () => {
  it("lists the hồ sơ Đã chuyển tỉnh not yet Tiếp nhận tại tỉnh in this lượt; a trả về after Tiếp nhận clears it, so the next lượt shows again", async () => {
    const up = await f.forwarded(ward, sets["Rau củ quả"]);
    const awaiting = async () => (await t.app.dossiers.list(province, { filter: "awaiting_province_receipt" })).map((d) => d.id);
    expect(await awaiting()).toContain(up.dossierId);

    const first = new Date("2026-10-20T03:00:00Z");
    t.clock.set(first);
    let { version } = await t.app.dossiers.receiveAtProvince(province, { dossierId: up.dossierId, expectedVersion: up.version });
    expect(await awaiting()).not.toContain(up.dossierId);

    // Story 17: the Sở still trả về after Tiếp nhận tại tỉnh; the Tiếp nhận of that lượt goes, the first stays.
    t.clock.set(new Date("2026-10-21T03:00:00Z"));
    ({ version } = await t.app.dossiers.returnFromProvince(province, { dossierId: up.dossierId, expectedVersion: version, ...RETURN }));
    expect(await t.app.dossiers.get(province, { dossierId: up.dossierId })).toMatchObject({
      state: "supplement_requested",
      provinceReceivedAt: null,
      provinceReceivedBy: null,
      firstProvinceReceivedAt: first,
    });
    expect(await awaiting()).not.toContain(up.dossierId);

    ({ version } = await t.app.dossiers.submit(up.a, { dossierId: up.dossierId, expectedVersion: version }));
    const fileId = await f.uploadPdf(ward, "signed_ward_report", "BC lần 2.pdf");
    ({ version } = await t.app.dossiers.attachSignedWardReport(ward, { dossierId: up.dossierId, expectedVersion: version, fileId }));
    ({ version } = await t.app.dossiers.forwardToProvince(ward, { dossierId: up.dossierId, expectedVersion: version }));
    expect(await awaiting()).toContain(up.dossierId);

    const second = new Date("2026-10-22T03:00:00Z");
    t.clock.set(second);
    await t.app.dossiers.receiveAtProvince(province, { dossierId: up.dossierId, expectedVersion: version });
    expect(await t.app.dossiers.get(province, { dossierId: up.dossierId })).toMatchObject({ provinceReceivedAt: second, firstProvinceReceivedAt: first });
    expect(await awaiting()).not.toContain(up.dossierId);
  });

  it("lets the Sở trả về before Tiếp nhận tại tỉnh too, and the hồ sơ is Chờ tiếp nhận when it is back", async () => {
    const up = await f.forwarded(ward, sets["Rau củ quả"]);
    const version = await backAtProvince(up, up.version);

    expect(await t.app.dossiers.get(province, { dossierId: up.dossierId })).toMatchObject({ provinceReceivedAt: null, firstProvinceReceivedAt: null });
    expect((await t.app.dossiers.list(province, { filter: "awaiting_province_receipt" })).map((d) => d.id)).toContain(up.dossierId);
    await expect(t.app.dossiers.receiveAtProvince(province, { dossierId: up.dossierId, expectedVersion: version })).resolves.toEqual({ version: version + 1 });
  });

  it("narrows by đợt, xã, Nhóm sản phẩm and state, together with Chờ tiếp nhận", async () => {
    const food = await f.forwarded(ward, sets["Rau củ quả"]);
    const drink = await f.forwarded(otherWard, sets["Thịt tươi"], otherWardId);
    const list = async (input: Parameters<TestApp["app"]["dossiers"]["list"]>[1]) => (await t.app.dossiers.list(province, input)).map((d) => d.id);
    const [foodRow] = (await t.app.dossiers.list(province)).filter((d) => d.id === food.dossierId);
    const [drinkRow] = (await t.app.dossiers.list(province)).filter((d) => d.id === drink.dossierId);
    expect(foodRow).toMatchObject({ ward: { id: wardId, name: "Xã An Phú" }, round: { id: roundId }, productGroup: { name: "Thực phẩm" } });
    expect(drinkRow).toMatchObject({ ward: { id: otherWardId, name: "Xã Bình Lợi" }, productGroup: { name: "Đồ uống" } });

    expect(await list({ wardId: otherWardId })).toContain(drink.dossierId);
    expect(await list({ wardId: otherWardId })).not.toContain(food.dossierId);
    expect(await list({ productGroupId: foodRow!.productGroup!.id })).toContain(food.dossierId);
    expect(await list({ productGroupId: foodRow!.productGroup!.id })).not.toContain(drink.dossierId);
    expect(await list({ roundId })).toEqual(expect.arrayContaining([food.dossierId, drink.dossierId]));
    expect(await list({ roundId: "0190a0a0-0000-7000-8000-000000000000" })).toEqual([]);
    expect(await list({ roundId: "not-a-uuid" })).toEqual([]);

    await t.app.dossiers.receiveAtProvince(province, { dossierId: drink.dossierId, expectedVersion: drink.version });
    const awaitingThere = await list({ filter: "awaiting_province_receipt", wardId: otherWardId });
    expect(awaitingThere).not.toContain(drink.dossierId);
    expect(await list({ state: "forwarded_to_province", wardId: otherWardId })).toContain(drink.dossierId);
    expect(await list({ state: "supplement_requested", wardId: otherWardId })).not.toContain(drink.dossierId);
  });
});

describe("Mã hồ sơ (story 19, SO-03)", () => {
  it("gives every hồ sơ a mã HS-<năm>-<số> from its creation, distinct, the same in the list and the detail", async () => {
    const a = await f.forwarded(ward, sets["Rau củ quả"]);
    const b = await f.forwarded(ward, sets["Rau củ quả"]);

    const detail = await t.app.dossiers.get(province, { dossierId: a.dossierId });
    expect(detail.code).toMatch(/^HS-2026-\d{4}$/);
    const listed = await t.app.dossiers.list(province);
    expect(listed.find((d) => d.id === a.dossierId)!.code).toBe(detail.code);
    expect(listed.find((d) => d.id === b.dossierId)!.code).not.toBe(detail.code);
    // The Chủ thể sees the same mã on its Nháp, before anything is submitted.
    const owner = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(owner, { criteriaSetId: sets["Rau củ quả"] });
    expect((await t.app.dossiers.get(owner, { dossierId })).code).toMatch(/^HS-2026-\d{4}$/);
  });

  it("keeps the mã and the first Tiếp nhận tại tỉnh once set: the DB refuses to change them", async () => {
    const up = await f.forwarded(ward, sets["Rau củ quả"]);
    await t.app.dossiers.receiveAtProvince(province, { dossierId: up.dossierId, expectedVersion: up.version });

    for (const set of ["code = 'HS-2026-9999'", "first_province_received_at = now()", "first_province_received_at = NULL"]) {
      await expect(db.app.query(`UPDATE dossier.dossier SET ${set}, version = version + 1 WHERE id = $1`, [up.dossierId])).rejects.toThrow(/fixed/);
      await expect(db.admin.query(`UPDATE dossier.dossier SET ${set}, version = version + 1 WHERE id = $1`, [up.dossierId])).rejects.toThrow(/fixed/);
    }
    // The Tiếp nhận of the lượt itself may still go back to null on a trả về.
    await expect(db.app.query("UPDATE dossier.dossier SET province_received_at = NULL, province_received_by = NULL, version = version + 1 WHERE id = $1", [up.dossierId])).resolves.toBeDefined();
  });
});
