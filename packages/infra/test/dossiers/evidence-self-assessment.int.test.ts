import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, EICAR, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, entityIdOf, fixtures } from "./fixtures";

let db: TestDatabase;
let t: TestApp;
let f: ReturnType<typeof fixtures>;
/** The Bộ tiêu chí every hồ sơ here is written on, with its Tiêu chí and Mức điểm ids by code and points. */
let setId: string;
let criterion: Record<"1.1" | "2.1" | "3.1", string>;
let level: (code: "1.1" | "2.1" | "3.1", points: number) => string;
/** A Bộ tiêu chí of an older published version, none of whose Tiêu chí belong to `setId`. */
let foreignSetId: string;
/** The published version of `setId`. */
let scoredVersionId: string;
const START = new Date("2026-10-19T02:00:00Z");

/**
 * One Bộ tiêu chí of 100 points under QĐ 26 Ngưỡng hạng (30/50/70/90):
 * - A 1.1 Nguyên liệu (40): 10, or 40 with Sao tối thiểu 4; the system adds "Không đáp ứng" at 0.
 * - B 2.1 Bao bì (25): 0 or 25.
 * - C 3.1 Chất lượng (35): 15, or 35 with Sao tối thiểu 3; the system adds 0.
 */
async function publishScoredVersion() {
  const row = (phan: string, phan_diem: number, ma: string, ten: string, lua_chon: { mo_ta: string; diem: number; sao_toi_thieu: 3 | 4 | null }[]) => ({
    phan,
    phan_ten: `PHẦN ${phan}`,
    phan_diem,
    muc: ma.split(".")[0],
    muc_ten: `MỤC ${ma.split(".")[0]}`,
    muc_diem: phan_diem,
    ma,
    ten,
    diem_toi_da: phan_diem,
    yeu_cau: "",
    ghi_chu: "",
    lua_chon: lua_chon.map((l, i) => ({ thu_tu: i + 1, ...l })),
  });
  const content = JSON.stringify({
    van_ban: "26/2026/QĐ-TTg",
    ngay_ban_hanh: "2026-01-02",
    hieu_luc: "2026-02-01",
    bo_tieu_chi: [
      {
        bo: 1,
        ten_bo: "Rau củ quả",
        san_pham: "Thực phẩm",
        nhom: "Thực phẩm tươi sống",
        ghi_chu_dau_phieu: "",
        tong_diem: 100,
        tieu_chi: [
          row("A", 40, "1.1", "Nguyên liệu", [
            { mo_ta: "Mua ngoài tỉnh", diem: 10, sao_toi_thieu: null },
            { mo_ta: "Vùng nguyên liệu của Chủ thể", diem: 40, sao_toi_thieu: 4 },
          ]),
          row("B", 25, "2.1", "Bao bì", [
            { mo_ta: "Không có bao bì", diem: 0, sao_toi_thieu: null },
            { mo_ta: "Bao bì đạt chuẩn", diem: 25, sao_toi_thieu: null },
          ]),
          row("C", 35, "3.1", "Chất lượng", [
            { mo_ta: "Có tự công bố", diem: 15, sao_toi_thieu: null },
            { mo_ta: "Có kiểm nghiệm định kỳ", diem: 35, sao_toi_thieu: 3 },
          ]),
        ],
      },
    ],
  });
  const a = await f.admin();
  const { versionId } = await t.app.criteria.importVersion(a, { fileName: "tieu-chi.json", content });
  await t.app.criteria.publishVersion(a, { versionId });
  scoredVersionId = versionId;
  const version = await t.app.criteria.getVersion(a, { versionId });
  setId = version.productGroups[0]!.subgroups[0]!.sets[0]!.id;
  const { set } = await t.app.criteria.getCriteriaSet(a, { setId });
  const all = set.parts.flatMap((p) => p.sections.flatMap((s) => s.items.flatMap((i) => (i.kind === "criterion" ? [i] : i.criteria))));
  criterion = Object.fromEntries(all.map((c) => [c.code, c.id])) as typeof criterion;
  level = (code, points) => all.find((c) => c.code === code)!.levels.find((l) => l.points === points)!.id;
}

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n");
  const wardId = (await t.app.org.listWards())[0]!.id;
  f = fixtures(t, () => wardId);
  foreignSetId = (await f.publishedVersion("01/2025/QĐ-TTg")).sets["Rau củ quả"];
  t.clock.advance(60_000); // published later, so new hồ sơ use it
  await publishScoredVersion();
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

/** A Chủ thể Đã xác thực with a new Nháp on the scored Bộ tiêu chí. */
async function draft() {
  const a = await f.verifiedOwner();
  const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: setId });
  return { a, dossierId };
}

async function evidenceIn(a: UserActor, dossierId: string, fileName: string, opts: { scan?: boolean; content?: Buffer } = {}) {
  const fileId = await f.uploadPdf(a, "evidence", fileName, opts);
  const { version } = await t.app.dossiers.get(a, { dossierId });
  await t.app.dossiers.addEvidenceFile(a, { dossierId, expectedVersion: version, fileId });
  return fileId;
}

const versionOf = async (a: UserActor, dossierId: string) => (await t.app.dossiers.get(a, { dossierId })).version;

describe("L02 CT-05 minh chứng theo tiêu chí (stories 20 to 22, 25)", () => {
  it("ties one file of the kho minh chứng to several Tiêu chí", async () => {
    const { a, dossierId } = await draft();
    const fileId = await evidenceIn(a, dossierId, "Kết quả kiểm nghiệm.pdf");

    await t.app.dossiers.linkEvidence(a, { dossierId, expectedVersion: await versionOf(a, dossierId), fileId, criterionIds: [criterion["1.1"], criterion["3.1"]] });

    const { criteria } = await t.app.dossiers.selfAssessment(a, { dossierId });
    expect(criteria.map((c) => [c.code, c.evidence.map((e) => e.fileName)])).toEqual([
      ["1.1", ["Kết quả kiểm nghiệm.pdf"]],
      ["2.1", []],
      ["3.1", ["Kết quả kiểm nghiệm.pdf"]],
    ]);
  });

  it("ties no file the virus scan has not found clean (story 22)", async () => {
    const { a, dossierId } = await draft();
    const scanning = await evidenceIn(a, dossierId, "Đang quét.pdf", { scan: false });
    // Put in the kho while scanning, then found infected.
    const blocked = await evidenceIn(a, dossierId, "Nhiễm virus.pdf", { content: Buffer.from(EICAR), scan: false });
    const version = await versionOf(a, dossierId);

    for (const fileId of [scanning, blocked]) {
      await expect(t.app.dossiers.linkEvidence(a, { dossierId, expectedVersion: version, fileId, criterionIds: [criterion["1.1"]] })).rejects.toMatchObject({
        code: "file_not_clean",
      });
    }
    // Once the scan finds it clean, it can be tied; the infected one never.
    await t.drainJobs();
    await expect(t.app.dossiers.linkEvidence(a, { dossierId, expectedVersion: version, fileId: blocked, criterionIds: [criterion["1.1"]] })).rejects.toMatchObject({
      code: "file_not_clean",
    });
    await t.app.dossiers.linkEvidence(a, { dossierId, expectedVersion: version, fileId: scanning, criterionIds: [criterion["1.1"]] });
    expect((await t.app.dossiers.selfAssessment(a, { dossierId })).criteria[0]!.evidence).toEqual([{ fileId: scanning, fileName: "Đang quét.pdf" }]);
  });

  it("ties a file only to Tiêu chí of the hồ sơ's own Bộ tiêu chí, and only a file of its kho", async () => {
    const { a, dossierId } = await draft();
    const fileId = await evidenceIn(a, dossierId, "Ảnh.pdf");
    const outside = await f.uploadPdf(a, "evidence", "Ngoài kho.pdf");
    const { set } = await t.app.criteria.getCriteriaSet(await f.admin(), { setId: foreignSetId });
    const foreign = set.parts[0]!.sections[0]!.items[0]!;
    const version = await versionOf(a, dossierId);

    await expect(t.app.dossiers.linkEvidence(a, { dossierId, expectedVersion: version, fileId, criterionIds: [foreign.id] })).rejects.toMatchObject({
      code: "criterion_not_in_set",
    });
    await expect(
      t.app.dossiers.linkEvidence(a, { dossierId, expectedVersion: version, fileId: outside, criterionIds: [criterion["1.1"]] }),
    ).rejects.toMatchObject({ code: "evidence_not_found" });
  });

  it("re-ties a file to other Tiêu chí, and removes it from the bản làm việc with its ties (story 20)", async () => {
    const { a, dossierId } = await draft();
    const keep = await evidenceIn(a, dossierId, "Giữ.pdf");
    const drop = await evidenceIn(a, dossierId, "Gỡ.pdf");
    let version = await versionOf(a, dossierId);
    ({ version } = await t.app.dossiers.linkEvidence(a, { dossierId, expectedVersion: version, fileId: keep, criterionIds: [criterion["1.1"], criterion["2.1"]] }));
    ({ version } = await t.app.dossiers.linkEvidence(a, { dossierId, expectedVersion: version, fileId: drop, criterionIds: [criterion["2.1"]] }));
    ({ version } = await t.app.dossiers.linkEvidence(a, { dossierId, expectedVersion: version, fileId: keep, criterionIds: [criterion["3.1"]] }));

    await t.app.dossiers.removeEvidenceFile(a, { dossierId, expectedVersion: version, fileId: drop });

    const after = await t.app.dossiers.selfAssessment(a, { dossierId });
    expect(after.criteria.map((c) => [c.code, c.evidence.map((e) => e.fileName)])).toEqual([
      ["1.1", []],
      ["2.1", []],
      ["3.1", ["Giữ.pdf"]],
    ]);
    expect(after.files).toEqual([expect.objectContaining({ fileId: keep, criterionIds: [criterion["3.1"]] })]);
    expect((await t.app.dossiers.get(a, { dossierId })).evidence.map((e) => e.fileName)).toEqual(["Giữ.pdf"]);
    // Taken out of the kho, it can be put back.
    await t.app.dossiers.addEvidenceFile(a, { dossierId, expectedVersion: await versionOf(a, dossierId), fileId: drop });
  });
});

describe("L02 CT-06 tự chấm thử (stories 23 to 25)", () => {
  it("estimates Phần A/B/C, tổng điểm and Hạng sao, naming the Tiêu chí that block the next Hạng sao", async () => {
    const { a, dossierId } = await draft();
    let version = await versionOf(a, dossierId);
    for (const [code, points] of [["1.1", 40], ["2.1", 25], ["3.1", 15]] as const) {
      ({ version } = await t.app.dossiers.selfScore(a, { dossierId, expectedVersion: version, criterionId: criterion[code], levelId: level(code, points) }));
    }

    // 80 points reach 4 sao by Ngưỡng hạng, but 3.1 at 15 misses its Sao tối thiểu 3 (35 points): 2 sao.
    const scored = await t.app.dossiers.selfAssessment(a, { dossierId });
    expect(scored.estimate).toMatchObject({
      parts: [
        { code: "A", total: 40 },
        { code: "B", total: 25 },
        { code: "C", total: 15 },
      ],
      total: 80,
      byThreshold: 4,
      star: 2,
    });
    expect(scored.blocking).toEqual([expect.objectContaining({ code: "3.1", star: 3, required: 35, actual: 15 })]);
    expect(scored.unscored).toBe(0);
    expect(scored.criteria.map((c) => [c.code, c.levelId, c.points])).toEqual([
      ["1.1", level("1.1", 40), 40],
      ["2.1", level("2.1", 25), 25],
      ["3.1", level("3.1", 15), 15],
    ]);

    await t.app.dossiers.selfScore(a, { dossierId, expectedVersion: version, criterionId: criterion["3.1"], levelId: level("3.1", 35) });
    expect((await t.app.dossiers.selfAssessment(a, { dossierId })).estimate).toMatchObject({ total: 100, star: 5 });
  });

  it("scores a Tiêu chí that has no minh chứng, at the system's 0-point Mức điểm too (stories 25, 30)", async () => {
    const { a, dossierId } = await draft();
    const zero = level("1.1", 0);
    await t.app.dossiers.selfScore(a, { dossierId, expectedVersion: await versionOf(a, dossierId), criterionId: criterion["1.1"], levelId: zero });

    const { criteria, estimate, unscored } = await t.app.dossiers.selfAssessment(a, { dossierId });
    expect(criteria[0]).toMatchObject({ code: "1.1", levelId: zero, points: 0, evidence: [] });
    expect(estimate).toMatchObject({ total: 0, star: 1 });
    expect(unscored).toBe(2);
  });

  it("clears a pick, and refuses a Mức điểm of another Tiêu chí or another Phiên bản tiêu chí", async () => {
    const { a, dossierId } = await draft();
    let { version } = await t.app.dossiers.selfScore(a, { dossierId, expectedVersion: await versionOf(a, dossierId), criterionId: criterion["2.1"], levelId: level("2.1", 25) });
    ({ version } = await t.app.dossiers.selfScore(a, { dossierId, expectedVersion: version, criterionId: criterion["2.1"], levelId: null }));
    expect((await t.app.dossiers.selfAssessment(a, { dossierId })).criteria[1]).toMatchObject({ levelId: null, points: null });

    const { set } = await t.app.criteria.getCriteriaSet(await f.admin(), { setId: foreignSetId });
    const foreignLevel = set.parts[0]!.sections[0]!.items[0]!;
    const foreignLevelId = foreignLevel.kind === "criterion" ? foreignLevel.levels[0]!.id : "";
    for (const levelId of [level("1.1", 40), foreignLevelId, "not-a-uuid"]) {
      await expect(t.app.dossiers.selfScore(a, { dossierId, expectedVersion: version, criterionId: criterion["2.1"], levelId })).rejects.toMatchObject({
        code: "level_not_in_criterion",
      });
    }
  });

  it("keeps a giải trình per Tiêu chí next to its tự chấm (story 21)", async () => {
    const { a, dossierId } = await draft();
    let { version } = await t.app.dossiers.explainCriterion(a, {
      dossierId,
      expectedVersion: await versionOf(a, dossierId),
      criterionId: criterion["1.1"],
      explanation: "  Vùng trồng 5 ha của hợp tác xã  ",
    });
    ({ version } = await t.app.dossiers.selfScore(a, { dossierId, expectedVersion: version, criterionId: criterion["1.1"], levelId: level("1.1", 40) }));

    expect((await t.app.dossiers.selfAssessment(a, { dossierId })).criteria[0]).toMatchObject({
      explanation: "Vùng trồng 5 ha của hợp tác xã",
      levelId: level("1.1", 40),
    });
    await t.app.dossiers.explainCriterion(a, { dossierId, expectedVersion: version, criterionId: criterion["1.1"], explanation: "" });
    expect((await t.app.dossiers.selfAssessment(a, { dossierId })).criteria[0]).toMatchObject({ explanation: "", levelId: level("1.1", 40) });
  });
});

describe("L02 CT-05, CT-06 on record, in Phạm vi and only on the bản làm việc (stories 27, 32, 80, 84, 87)", () => {
  it("writes each change in the audit log and the outbox, off the timeline", async () => {
    const { a, dossierId } = await draft();
    const fileId = await evidenceIn(a, dossierId, "Minh chứng.pdf");
    let version = await versionOf(a, dossierId);
    ({ version } = await t.app.dossiers.linkEvidence(a, { dossierId, expectedVersion: version, fileId, criterionIds: [criterion["2.1"]] }));
    ({ version } = await t.app.dossiers.selfScore(a, { dossierId, expectedVersion: version, criterionId: criterion["2.1"], levelId: level("2.1", 25) }));
    ({ version } = await t.app.dossiers.explainCriterion(a, { dossierId, expectedVersion: version, criterionId: criterion["2.1"], explanation: "Có mẫu bao bì" }));
    await t.app.dossiers.removeEvidenceFile(a, { dossierId, expectedVersion: version, fileId });

    const admin = await f.admin();
    const audit = async (action: string) => (await t.app.audit.search(admin, { action: [action], targetId: dossierId }))[0];
    expect(await audit("dossier.evidence.link")).toMatchObject({ actorUserId: a.userId, actorRole: "entity_owner", metadata: { fileId, criterionIds: [criterion["2.1"]] } });
    expect(await audit("dossier.self_score")).toMatchObject({ metadata: { criterionId: criterion["2.1"], levelId: level("2.1", 25), points: 25 } });
    expect(await audit("dossier.explain")).toMatchObject({ metadata: { criterionId: criterion["2.1"] } });
    expect(await audit("dossier.evidence.remove")).toMatchObject({ metadata: { fileId } });
    const { rows } = await db.admin.query("SELECT type, payload FROM platform.outbox WHERE payload->>'dossierId' = $1 ORDER BY id", [dossierId]);
    expect(rows.map((r: { type: string }) => r.type)).toEqual([
      "dossier.created",
      "dossier.evidence_added",
      "dossier.evidence_linked",
      "dossier.self_scored",
      "dossier.explained",
      "dossier.evidence_removed",
    ]);
    expect(rows[3].payload).toEqual({ dossierId, entityId: entityIdOf(a), from: "draft", to: "draft" });
    expect((await t.app.dossiers.timeline(a, { dossierId })).map((e) => e.action)).toEqual(["dossier.create"]);
  });

  it("refuses the second of two writes made from the same version (story 87)", async () => {
    const { a, dossierId } = await draft();
    const version = await versionOf(a, dossierId);
    await t.app.dossiers.selfScore(a, { dossierId, expectedVersion: version, criterionId: criterion["1.1"], levelId: level("1.1", 10) });
    await expect(
      t.app.dossiers.explainCriterion(a, { dossierId, expectedVersion: version, criterionId: criterion["1.1"], explanation: "Muộn" }),
    ).rejects.toMatchObject({ code: "version_conflict" });
    expect((await t.app.dossiers.selfAssessment(a, { dossierId })).criteria[0]).toMatchObject({ points: 10, explanation: "" });
  });

  it("another Chủ thể neither reads nor changes it: not found", async () => {
    const { a, dossierId } = await draft();
    const fileId = await evidenceIn(a, dossierId, "Của A.pdf");
    const b = await f.verifiedOwner();
    const version = await versionOf(a, dossierId);
    const notFound = { code: "not_found" };

    await expect(t.app.dossiers.selfAssessment(b, { dossierId })).rejects.toMatchObject(notFound);
    await expect(t.app.dossiers.selfAssessment(b, { dossierId: "not-a-uuid" })).rejects.toMatchObject(notFound);
    await expect(t.app.dossiers.linkEvidence(b, { dossierId, expectedVersion: version, fileId, criterionIds: [criterion["1.1"]] })).rejects.toMatchObject(notFound);
    await expect(t.app.dossiers.removeEvidenceFile(b, { dossierId, expectedVersion: version, fileId })).rejects.toMatchObject(notFound);
    await expect(t.app.dossiers.selfScore(b, { dossierId, expectedVersion: version, criterionId: criterion["1.1"], levelId: level("1.1", 10) })).rejects.toMatchObject(notFound);
    await expect(t.app.dossiers.explainCriterion(b, { dossierId, expectedVersion: version, criterionId: criterion["1.1"], explanation: "x" })).rejects.toMatchObject(notFound);
    await expect(t.app.dossiers.selfAssessment(await f.admin(), { dossierId })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("changes nothing once the hồ sơ has left Nháp, yet still shows it (story 32)", async () => {
    const { a, dossierId } = await draft();
    const fileId = await evidenceIn(a, dossierId, "Đã nộp.pdf");
    let version = await versionOf(a, dossierId);
    ({ version } = await t.app.dossiers.linkEvidence(a, { dossierId, expectedVersion: version, fileId, criterionIds: [criterion["1.1"]] }));
    ({ version } = await t.app.dossiers.selfScore(a, { dossierId, expectedVersion: version, criterionId: criterion["1.1"], levelId: level("1.1", 40) }));
    ({ version } = await t.app.dossiers.selfScore(a, { dossierId, expectedVersion: version, criterionId: criterion["2.1"], levelId: level("2.1", 0) }));
    ({ version } = await t.app.dossiers.selfScore(a, { dossierId, expectedVersion: version, criterionId: criterion["3.1"], levelId: level("3.1", 15) }));
    ({ version } = await t.app.dossiers.updateProduct(a, { dossierId, expectedVersion: version, productName: "Bưởi" }));
    await f.openRound(scoredVersionId);
    ({ version } = await t.app.dossiers.submit(a, { dossierId, expectedVersion: version }));

    const invalid = { code: "invalid_state" };
    await expect(t.app.dossiers.linkEvidence(a, { dossierId, expectedVersion: version, fileId, criterionIds: [] })).rejects.toMatchObject(invalid);
    await expect(t.app.dossiers.removeEvidenceFile(a, { dossierId, expectedVersion: version, fileId })).rejects.toMatchObject(invalid);
    await expect(t.app.dossiers.selfScore(a, { dossierId, expectedVersion: version, criterionId: criterion["1.1"], levelId: null })).rejects.toMatchObject(invalid);
    await expect(t.app.dossiers.explainCriterion(a, { dossierId, expectedVersion: version, criterionId: criterion["1.1"], explanation: "x" })).rejects.toMatchObject(invalid);
    expect((await t.app.dossiers.selfAssessment(a, { dossierId })).criteria[0]).toMatchObject({
      levelId: level("1.1", 40),
      evidence: [{ fileId, fileName: "Đã nộp.pdf" }],
    });
  });

  it("Sao chép sang hồ sơ mới takes the files untied, never the tự chấm or giải trình (story 27)", async () => {
    const { a, dossierId } = await draft();
    const fileId = await evidenceIn(a, dossierId, "Chép.pdf");
    let version = await versionOf(a, dossierId);
    ({ version } = await t.app.dossiers.linkEvidence(a, { dossierId, expectedVersion: version, fileId, criterionIds: [criterion["1.1"]] }));
    ({ version } = await t.app.dossiers.selfScore(a, { dossierId, expectedVersion: version, criterionId: criterion["1.1"], levelId: level("1.1", 40) }));
    await t.app.dossiers.explainCriterion(a, { dossierId, expectedVersion: version, criterionId: criterion["1.1"], explanation: "Không chép" });

    const { dossierId: copyId } = await t.app.dossiers.copy(a, { dossierId, criteriaSetId: setId });

    const copy = await t.app.dossiers.selfAssessment(a, { dossierId: copyId });
    expect(copy.files).toEqual([expect.objectContaining({ fileId, criterionIds: [] })]);
    expect(copy.criteria.every((c) => c.levelId === null && c.explanation === "" && c.evidence.length === 0)).toBe(true);
    expect(copy.estimate).toMatchObject({ total: 0 });
  });
});

describe("tự chấm in the database", () => {
  it("refuses a Mức điểm that is not of the Tiêu chí it is stored against", async () => {
    const { dossierId } = await draft();
    await expect(
      db.app.query("INSERT INTO dossier.criterion_entry (dossier_id, criterion_id, score_level_id, updated_at) VALUES ($1, $2, $3, now())", [
        dossierId,
        criterion["2.1"],
        level("1.1", 40),
      ]),
    ).rejects.toThrow(/foreign key/);
  });
});
