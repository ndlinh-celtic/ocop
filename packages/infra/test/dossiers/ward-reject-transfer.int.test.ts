import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "./fixtures";

let db: TestDatabase;
let t: TestApp;
let wardX: string;
let wardY: string;
let f: ReturnType<typeof fixtures>;
let sets: Record<"Rau củ quả" | "Thịt tươi", string>;
let otherSetExclusion: string;
let exclusions: { id: string; description: string }[];
let officerX: UserActor;
let officerY: UserActor;
const START = new Date("2026-10-19T02:00:00Z");

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n00002,Xã Bình Lợi\n");
  const wards = await t.app.org.listWards();
  wardX = wards.find((w) => w.name === "Xã An Phú")!.id;
  wardY = wards.find((w) => w.name === "Xã Bình Lợi")!.id;
  f = fixtures(t, () => wardX);
  t.clock.set(START);
  const version = await f.publishedVersion("26/2026/QĐ-TTg", {
    exclusions: "Hồ sơ bị loại khi: sản phẩm không có công bố chất lượng; hoặc sử dụng nguyên liệu nhập khẩu",
  });
  sets = version.sets;
  await f.openRound(version.versionId);
  officerX = await f.staff("ward_officer", wardX);
  officerY = await f.staff("ward_officer", wardY);
  exclusions = [...(await t.app.criteria.getCriteriaSet(officerX, { setId: sets["Rau củ quả"] })).set.exclusionConditions];
  otherSetExclusion = (await t.app.criteria.getCriteriaSet(officerX, { setId: sets["Thịt tươi"] })).set.exclusionConditions[0]!.id;
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("L05 XA-06 xã loại hồ sơ về Không đạt sơ bộ (stories 35, 63, 84)", () => {
  it("rejects citing an Điều kiện loại of the hồ sơ's Bộ tiêu chí; the Chủ thể sees why", async () => {
    const { a, dossierId, version } = await f.received(officerX, sets["Rau củ quả"]);
    const condition = exclusions[1]!;

    const after = await t.app.dossiers.reject(officerX, {
      dossierId,
      expectedVersion: version,
      exclusionConditionId: condition.id,
      explanation: "Nguyên liệu nhập từ nước ngoài",
    });

    expect(after.version).toBe(version + 1);
    const seen = await t.app.dossiers.get(a, { dossierId });
    expect(seen).toMatchObject({
      state: "rejected_preliminary",
      rejection: {
        kind: "exclusion_condition",
        exclusionConditionId: condition.id,
        text: "Sử dụng nguyên liệu nhập khẩu",
        explanation: "Nguyên liệu nhập từ nước ngoài",
        rejectedAt: START,
      },
    });
    expect((await t.app.dossiers.timeline(a, { dossierId })).at(-1)).toMatchObject({
      action: "dossier.reject",
      fromState: "submitted_to_ward",
      toState: "rejected_preliminary",
      actorUserId: officerX.userId,
    });
    const [audit] = await t.app.audit.search(await f.admin(), { action: ["dossier.reject"], targetId: dossierId });
    expect(audit).toMatchObject({ actorUserId: officerX.userId, actorRole: "ward_officer", metadata: { exclusionConditionId: condition.id } });
    const { rows } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.rejected_preliminary' AND payload->>'dossierId' = $1", [
      dossierId,
    ]);
    expect(rows).toHaveLength(1);
  });

  it("rejects with a Lý do loại sơ bộ and its diễn giải, shown to the Chủ thể with the label of the Lý do", async () => {
    const { a, dossierId, version } = await f.received(officerX, sets["Rau củ quả"]);

    await t.app.dossiers.reject(officerX, {
      dossierId,
      expectedVersion: version,
      reasonCode: "not_eligible",
      explanation: "Chủ thể là hộ kinh doanh thương mại",
    });

    expect((await t.app.dossiers.get(a, { dossierId })).rejection).toEqual({
      kind: "preliminary_reason",
      reasonCode: "not_eligible",
      text: "Không đúng đối tượng",
      explanation: "Chủ thể là hộ kinh doanh thương mại",
      rejectedAt: START,
    });
    expect((await t.app.dossiers.get(officerX, { dossierId })).rejection).toMatchObject({ reasonCode: "not_eligible" });
  });

  it("requires exactly one ground: an Điều kiện loại of this Bộ tiêu chí, or a Lý do loại sơ bộ with a diễn giải", async () => {
    const { dossierId, version } = await f.received(officerX, sets["Rau củ quả"]);
    const attempt = (input: Record<string, unknown>) => t.app.dossiers.reject(officerX, { dossierId, expectedVersion: version, ...input });

    await expect(attempt({})).rejects.toMatchObject({ code: "rejection_ground_required" });
    await expect(attempt({ exclusionConditionId: exclusions[0]!.id, reasonCode: "other", explanation: "Cả hai" })).rejects.toMatchObject({
      code: "rejection_ground_required",
    });
    await expect(attempt({ exclusionConditionId: otherSetExclusion })).rejects.toMatchObject({ code: "invalid_exclusion_condition" });
    await expect(attempt({ exclusionConditionId: "khong-phai-id" })).rejects.toMatchObject({ code: "invalid_exclusion_condition" });
    await expect(attempt({ reasonCode: "other", explanation: "   " })).rejects.toMatchObject({ code: "explanation_required" });
    await expect(attempt({ reasonCode: "khong_co", explanation: "Lý do lạ" })).rejects.toMatchObject({ code: "invalid_rejection_reason" });
    expect((await t.app.dossiers.get(officerX, { dossierId })).state).toBe("submitted_to_ward");
  });

  it("is for the Cán bộ xã of the hồ sơ's xã only, on a hồ sơ Đã nộp xã (stories 80, 81, 87)", async () => {
    const { a, dossierId, version } = await f.received(officerX, sets["Rau củ quả"]);
    const ground = { reasonCode: "other", explanation: "Thử" };

    await expect(t.app.dossiers.reject(a, { dossierId, expectedVersion: version, ...ground })).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.dossiers.reject(officerY, { dossierId, expectedVersion: version, ...ground })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.dossiers.reject(officerX, { dossierId, expectedVersion: version - 1, ...ground })).rejects.toMatchObject({ code: "version_conflict" });

    const { version: rejected } = await t.app.dossiers.reject(officerX, { dossierId, expectedVersion: version, ...ground });

    await expect(t.app.dossiers.reject(officerX, { dossierId, expectedVersion: rejected, ...ground })).rejects.toMatchObject({ code: "invalid_state" });
  });

  it("comes after Tiếp nhận: a hồ sơ Chờ tiếp nhận cannot be loại yet (XA-06)", async () => {
    const { dossierId, version } = await f.submitted(sets["Rau củ quả"]);

    await expect(t.app.dossiers.reject(officerX, { dossierId, expectedVersion: version, reasonCode: "other", explanation: "Thử" })).rejects.toMatchObject({
      code: "not_received",
    });
    expect((await t.app.dossiers.get(officerX, { dossierId })).state).toBe("submitted_to_ward");
  });
});

describe("L05 Chuyển xã (stories 47 to 49, 84)", () => {
  it("moves a hồ sơ to the right xã: Tiếp nhận and Cán bộ phụ trách cleared, the Chủ thể keeps its xã đăng ký", async () => {
    const { a, dossierId, version } = await f.submitted(sets["Rau củ quả"]);
    const { version: received } = await t.app.dossiers.receive(officerX, { dossierId, expectedVersion: version });
    t.clock.set(new Date("2026-10-20T03:00:00Z"));

    const after = await t.app.dossiers.transferWard(officerX, { dossierId, expectedVersion: received, wardId: wardY, reason: "Cơ sở sản xuất ở Bình Lợi" });

    expect(after.version).toBe(received + 1);
    // The xã it left no longer sees it, by id or in its lists.
    await expect(t.app.dossiers.get(officerX, { dossierId })).rejects.toMatchObject({ code: "not_found" });
    expect((await t.app.dossiers.list(officerX)).map((d) => d.id)).not.toContain(dossierId);
    // The xã it went to has it in Chờ tiếp nhận, with the hồ sơ pháp lý of the Chủ thể.
    expect((await t.app.dossiers.list(officerY, { filter: "awaiting_receipt" })).map((d) => d.id)).toContain(dossierId);
    expect(await t.app.dossiers.get(officerY, { dossierId })).toMatchObject({
      state: "submitted_to_ward",
      wardId: wardY,
      receivedAt: null,
      receivedBy: null,
      handlerUserId: null,
    });
    const entityId = a.activeScope!.id!;
    expect((await t.app.entities.getLegalStanding(officerY, { entityId })).documents).toHaveLength(1);
    expect(await t.app.entities.getEntity(a, { entityId })).toMatchObject({ ward: { id: wardX } });
    // …and Tiếp nhận it afresh.
    await t.app.dossiers.receive(officerY, { dossierId, expectedVersion: after.version });

    expect((await t.app.dossiers.timeline(a, { dossierId })).find((e) => e.action === "dossier.ward_transfer")).toMatchObject({
      fromState: "submitted_to_ward",
      toState: "submitted_to_ward",
      actorUserId: officerX.userId,
      reason: "Cơ sở sản xuất ở Bình Lợi",
      metadata: { fromWardId: wardX, toWardId: wardY },
    });
    const [audit] = await t.app.audit.search(await f.admin(), { action: ["dossier.ward_transfer"], targetId: dossierId });
    expect(audit).toMatchObject({ actorUserId: officerX.userId, metadata: { fromWardId: wardX, toWardId: wardY, reason: "Cơ sở sản xuất ở Bình Lợi" } });
    const { rows } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.ward_transferred' AND payload->>'dossierId' = $1", [dossierId]);
    expect(rows).toHaveLength(1);
  });

  it("needs a reason and another existing xã, and is for the Cán bộ xã of the hồ sơ's xã only", async () => {
    const { a, dossierId, version } = await f.submitted(sets["Rau củ quả"]);
    const move = (actor: UserActor, input: Record<string, unknown>) =>
      t.app.dossiers.transferWard(actor, { dossierId, expectedVersion: version, wardId: wardY, reason: "Sai địa bàn", ...input });

    await expect(move(officerX, { reason: " " })).rejects.toMatchObject({ code: "reason_required" });
    await expect(move(officerX, { wardId: wardX })).rejects.toMatchObject({ code: "same_ward" });
    await expect(move(officerX, { wardId: "00000000-0000-7000-8000-000000000000" })).rejects.toMatchObject({ code: "invalid_ward" });
    await expect(move(officerX, { wardId: "khong-phai-id" })).rejects.toMatchObject({ code: "invalid_ward" });
    await expect(move(a, {})).rejects.toMatchObject({ code: "forbidden" });
    await expect(move(officerY, {})).rejects.toMatchObject({ code: "not_found" });
    expect(await t.app.dossiers.get(officerX, { dossierId })).toMatchObject({ wardId: wardX, version });
  });
});

describe("L05 thông báo loại and Chuyển xã (story 86)", () => {
  const latestFor = async (actor: UserActor, dossierId: string) => (await t.app.notifications.list(actor)).find((n) => n.link?.endsWith(dossierId));

  it("tells the Chủ thể, in the app and by email, that its hồ sơ was loại", async () => {
    const { a, dossierId, version } = await f.received(officerX, sets["Rau củ quả"]);
    await t.drainJobs();
    await t.app.dossiers.reject(officerX, { dossierId, expectedVersion: version, reasonCode: "wrong_ward", explanation: "Ngoài địa bàn" });
    await t.drainJobs();

    expect(await latestFor(a, dossierId)).toMatchObject({ kind: "dossier_rejected_preliminary", link: `/chu-the/ho-so/${dossierId}` });
    expect(t.mailbox.to(a.email).at(-1)).toMatchObject({ subject: expect.stringContaining("Không đạt sơ bộ") });
  });

  it("tells the Chủ thể and every Cán bộ xã of the xã it went to; the xã it left hears nothing", async () => {
    const { a, dossierId, version } = await f.submitted(sets["Rau củ quả"]);
    await t.drainJobs();
    const before = (await t.app.notifications.list(officerX)).length;
    await t.app.dossiers.transferWard(officerX, { dossierId, expectedVersion: version, wardId: wardY, reason: "Sai địa bàn" });
    await t.drainJobs();

    expect(await latestFor(a, dossierId)).toMatchObject({ kind: "dossier_ward_transferred", link: `/chu-the/ho-so/${dossierId}` });
    expect(t.mailbox.to(a.email).at(-1)).toMatchObject({ subject: expect.stringContaining("chuyển") });
    expect(await latestFor(officerY, dossierId)).toMatchObject({ kind: "dossier_ward_transferred_in", link: `/xa/ho-so/${dossierId}` });
    expect(t.mailbox.to(officerY.email).at(-1)!.text).toContain(`/xa/ho-so/${dossierId}`);
    expect((await t.app.notifications.list(officerX)).length).toBe(before);
  });
});
