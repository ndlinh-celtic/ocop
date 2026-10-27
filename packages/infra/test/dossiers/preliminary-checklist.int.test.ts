import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "./fixtures";

let db: TestDatabase;
let t: TestApp;
let wardX: string;
let f: ReturnType<typeof fixtures>;
let versionId: string;
let sets: Record<"Rau củ quả" | "Thịt tươi", string>;
let province: UserActor;
let openRoundId: string;
const START = new Date("2026-10-19T02:00:00Z");

const DEFAULT_LABELS = [
  "Tính pháp lý (giấy tờ kinh doanh, an toàn thực phẩm, môi trường)",
  "Tính hợp lệ của Phiếu đăng ký và Báo cáo tự đánh giá",
  "Nguồn gốc nguyên liệu địa phương và quy mô sản xuất",
  "Lao động địa phương",
  "Bản sắc văn hóa và trí tuệ bản địa",
];

const draftRound = (officer: UserActor) =>
  t.app.rounds.createRound(officer, {
    name: "Đợt thử checklist",
    year: 2026,
    submissionDeadline: "2026-11-30",
    forwardingDeadline: "2026-12-15",
    evaluationDeadline: "2027-01-31",
    criteriaVersionId: versionId,
    gradingMode: "direct",
    aggregation: { method: "mean", minGraders: 5, deviationFlagPoints: 15 },
  });

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n");
  wardX = (await t.app.org.listWards())[0]!.id;
  f = fixtures(t, () => wardX);
  t.clock.set(START);
  ({ versionId, sets } = await f.publishedVersion("26/2026/QĐ-TTg"));
  province = await f.staff("province_officer");
  openRoundId = await f.openRound(versionId);
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("L06 XA-04 Checklist sơ bộ của đợt (story 60)", () => {
  it("a new round carries the five default items, in order", async () => {
    const { roundId } = await draftRound(province);

    const round = await t.app.rounds.getRound(province, { roundId });

    expect(round.checklist.map((i) => i.label)).toEqual(DEFAULT_LABELS);
    expect(new Set(round.checklist.map((i) => i.code)).size).toBe(5);
  });

  it("Cán bộ Sở edits the items while the round is Nháp: renames keep their code, new items get one, removed ones go", async () => {
    const { roundId } = await draftRound(province);
    const [legal, , , labor] = (await t.app.rounds.getRound(province, { roundId })).checklist;

    await t.app.rounds.configureChecklist(province, {
      roundId,
      items: [{ code: labor!.code, label: "Lao động là người địa phương" }, { code: legal!.code, label: legal!.label }, { label: "  Vùng nguyên liệu  " }],
    });

    const { checklist } = await t.app.rounds.getRound(province, { roundId });
    expect(checklist).toEqual([
      { code: labor!.code, label: "Lao động là người địa phương" },
      { code: legal!.code, label: legal!.label },
      { code: expect.any(String), label: "Vùng nguyên liệu" },
    ]);
    expect(new Set(checklist.map((i) => i.code)).size).toBe(3);
    const [entry] = await t.app.audit.search(await f.admin(), { action: ["round.checklist_configured"], targetId: roundId });
    expect(entry).toMatchObject({ actorUserId: province.userId, after: { checklist } });
  });

  it("refuses an empty list or a blank label", async () => {
    const { roundId } = await draftRound(province);
    await expect(t.app.rounds.configureChecklist(province, { roundId, items: [] })).rejects.toMatchObject({ code: "invalid_checklist" });
    await expect(t.app.rounds.configureChecklist(province, { roundId, items: [{ label: " " }] })).rejects.toMatchObject({ code: "invalid_checklist" });
  });

  it("refuses to change the items once the round is opened, and the DB refuses it too", async () => {
    const roundId = openRoundId;
    await expect(t.app.rounds.configureChecklist(province, { roundId, items: [{ label: "Mục mới" }] })).rejects.toMatchObject({ code: "round_not_draft" });
    await expect(db.app.query(`UPDATE round.round SET checklist = '[{"code":"x","label":"x"}]' WHERE id = $1`, [roundId])).rejects.toThrow(
      /checklist is fixed/,
    );
  });

  it("only Cán bộ Sở configures it", async () => {
    const { roundId } = await draftRound(province);
    const ward = await f.staff("ward_officer", wardX);
    await expect(t.app.rounds.configureChecklist(ward, { roundId, items: [{ label: "Mục" }] })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("L06 XA-04 Cán bộ xã đánh giá Checklist sơ bộ của hồ sơ (stories 61, 62)", () => {
  /** A hồ sơ submitted into the open round and Tiếp nhận by `officer`. */
  async function received(officer: UserActor) {
    const s = await f.submitted(sets["Rau củ quả"]);
    const { version } = await t.app.dossiers.receive(officer, { dossierId: s.dossierId, expectedVersion: s.version });
    return { ...s, version };
  }

  it("records pass, fail or needs verification per item with nhận xét, and suggests Đủ only when every item passes", async () => {
    const officer = await f.staff("ward_officer", wardX);
    const { dossierId, version } = await received(officer);
    const before = await t.app.dossiers.checklist(officer, { dossierId });
    expect(before).toMatchObject({ complete: false, suggestion: "not_eligible" });
    expect(before.items.map((i) => [i.label, i.result])).toEqual(DEFAULT_LABELS.map((l) => [l, null]));
    const codes = before.items.map((i) => i.code);

    const { version: v2 } = await t.app.dossiers.assessChecklist(officer, {
      dossierId,
      expectedVersion: version,
      results: codes.map((itemCode, n) => ({ itemCode, result: n === 3 ? "needs_verification" : "pass", comment: n === 3 ? "Cần xem bảng lương" : "" })),
    });
    const partial = await t.app.dossiers.checklist(officer, { dossierId });
    expect(partial).toMatchObject({ complete: true, suggestion: "not_eligible" });
    expect(partial.items[3]).toMatchObject({ result: "needs_verification", comment: "Cần xem bảng lương" });

    await t.app.dossiers.assessChecklist(officer, {
      dossierId,
      expectedVersion: v2,
      results: [{ itemCode: codes[3]!, result: "pass", comment: "Đã xác minh" }],
    });
    const all = await t.app.dossiers.checklist(officer, { dossierId });
    expect(all).toMatchObject({ complete: true, suggestion: "eligible" });
    expect(all.items.every((i) => i.result === "pass")).toBe(true);
  });

  it("refuses Cần xác minh without nhận xét", async () => {
    const officer = await f.staff("ward_officer", wardX);
    const { dossierId, version } = await received(officer);
    const [item] = (await t.app.dossiers.checklist(officer, { dossierId })).items;

    await expect(
      t.app.dossiers.assessChecklist(officer, {
        dossierId,
        expectedVersion: version,
        results: [{ itemCode: item!.code, result: "needs_verification", comment: "  " }],
      }),
    ).rejects.toMatchObject({ code: "comment_required" });
    await expect(
      t.app.dossiers.assessChecklist(officer, { dossierId, expectedVersion: version, results: [{ itemCode: "khong-co", result: "pass" }] }),
    ).rejects.toMatchObject({ code: "invalid_checklist_item" });
  });

  it("writes audit and outbox in the same transaction, off the timeline", async () => {
    const officer = await f.staff("ward_officer", wardX);
    const { dossierId, version } = await received(officer);
    const [item] = (await t.app.dossiers.checklist(officer, { dossierId })).items;

    await t.app.dossiers.assessChecklist(officer, {
      dossierId,
      expectedVersion: version,
      results: [{ itemCode: item!.code, result: "fail", comment: "Thiếu giấy VSATTP" }],
    });

    const [entry] = await t.app.audit.search(await f.admin(), { action: ["dossier.checklist.assess"], targetId: dossierId });
    expect(entry).toMatchObject({
      actorUserId: officer.userId,
      metadata: { results: [{ itemCode: item!.code, result: "fail", comment: "Thiếu giấy VSATTP" }] },
    });
    const { rowCount } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.checklist_assessed' AND payload->>'dossierId' = $1", [
      dossierId,
    ]);
    expect(rowCount).toBe(1);
    expect((await t.app.dossiers.timeline(officer, { dossierId })).map((e) => e.action)).not.toContain("dossier.checklist.assess");
  });

  it("the Chủ thể reads the results but never the nhận xét (story 35)", async () => {
    const officer = await f.staff("ward_officer", wardX);
    const { a, dossierId, version } = await received(officer);
    const [item] = (await t.app.dossiers.checklist(officer, { dossierId })).items;
    await t.app.dossiers.assessChecklist(officer, {
      dossierId,
      expectedVersion: version,
      results: [{ itemCode: item!.code, result: "needs_verification", comment: "GHI-CHU-NOI-BO" }],
    });

    const own = await t.app.dossiers.checklist(a, { dossierId });
    expect(own.items[0]).toMatchObject({ code: item!.code, result: "needs_verification" });
    expect(own.items[0]).not.toHaveProperty("comment");
    const everything = JSON.stringify([own, await t.app.dossiers.get(a, { dossierId }), await t.app.dossiers.timeline(a, { dossierId })]);
    expect(everything).not.toContain("GHI-CHU-NOI-BO");
  });

  it("is assessed only after Tiếp nhận, and only by a Cán bộ xã of the hồ sơ's xã", async () => {
    const officer = await f.staff("ward_officer", wardX);
    const s = await f.submitted(sets["Rau củ quả"]);
    const [item] = (await t.app.dossiers.checklist(officer, { dossierId: s.dossierId })).items;
    const results = [{ itemCode: item!.code, result: "pass" as const }];

    await expect(t.app.dossiers.assessChecklist(officer, { dossierId: s.dossierId, expectedVersion: s.version, results })).rejects.toMatchObject({
      code: "not_received",
    });
    await expect(t.app.dossiers.assessChecklist(s.a, { dossierId: s.dossierId, expectedVersion: s.version, results })).rejects.toMatchObject({
      code: "forbidden",
    });
    await seedWards(db.app, "ma,ten\n00009,Xã Khác\n");
    const otherWard = (await t.app.org.listWards()).find((w) => w.name === "Xã Khác")!.id;
    const stranger = await f.staff("ward_officer", otherWard);
    await expect(t.app.dossiers.checklist(stranger, { dossierId: s.dossierId })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.dossiers.assessChecklist(stranger, { dossierId: s.dossierId, expectedVersion: s.version, results })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("can be changed until the hồ sơ is gửi tỉnh, not after", async () => {
    const officer = await f.staff("ward_officer", wardX);
    const { dossierId, version } = await received(officer);
    const { items } = await t.app.dossiers.checklist(officer, { dossierId });
    const { version: v2 } = await t.app.dossiers.assessChecklist(officer, {
      dossierId,
      expectedVersion: version,
      results: items.map((i) => ({ itemCode: i.code, result: "fail" as const })),
    });
    const fileId = await f.uploadPdf(officer, "signed_ward_report", "BC xã đã ký.pdf");
    const { version: v3 } = await t.app.dossiers.attachSignedWardReport(officer, { dossierId, expectedVersion: v2, fileId });
    const { version: v4 } = await t.app.dossiers.forwardToProvince(officer, { dossierId, expectedVersion: v3 });

    await expect(
      t.app.dossiers.assessChecklist(officer, { dossierId, expectedVersion: v4, results: [{ itemCode: items[0]!.code, result: "pass" }] }),
    ).rejects.toMatchObject({ code: "invalid_state" });
  });
});
