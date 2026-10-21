import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdvisoryReportLineInput, UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "../dossiers/fixtures";

/*
 * L10 TM-01, TM-02, TM-05, TM-06 and L11 TM-07, TM-12 (#56, spec #49 stories 42 to 50, 56 to 64): the Thành
 * viên Tổ tư vấn Phân công on a hồ sơ in Tổ tư vấn thẩm định write one Báo cáo Tổ tư vấn nháp together; the
 * Tổ trưởng issues it as phiên bản N, fixed, and N+1 with a reason; the thành viên chấm read the issued ones.
 */

let db: TestDatabase;
let t: TestApp;
let f: ReturnType<typeof fixtures>;
let wardId: string;
let setId: string;
let ward: UserActor;
let province: UserActor;
let A: Awaited<ReturnType<ReturnType<typeof fixtures>["staffedCouncil"]>>;
let leader: UserActor;
let colleague: UserActor;
const START = new Date("2026-10-19T02:00:00Z");

/** A Bộ tiêu chí of three Tiêu chí over Phần A (1.1, 1.2) and B (2.1), so sums by Phần and missing lists mean something. */
const VERSION = JSON.stringify({
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
        criterion("A", 60, "1", "1.1", "Tổ chức sản xuất", 40),
        criterion("A", 60, "1", "1.2", "Liên kết chuỗi", 20),
        criterion("B", 40, "2", "2.1", "Chất lượng", 40),
      ],
    },
  ],
});

function criterion(phan: string, phanDiem: number, muc: string, ma: string, ten: string, max: number) {
  return {
    phan,
    phan_ten: `PHẦN ${phan}`,
    phan_diem: phanDiem,
    muc,
    muc_ten: `MỤC ${muc}`,
    muc_diem: phanDiem,
    ma,
    ten,
    diem_toi_da: max,
    yeu_cau: "",
    ghi_chu: "",
    lua_chon: [
      { thu_tu: 1, mo_ta: "Không đáp ứng", diem: 0, sao_toi_thieu: null },
      { thu_tu: 2, mo_ta: "Đáp ứng một phần", diem: max / 2, sao_toi_thieu: null },
      { thu_tu: 3, mo_ta: "Đáp ứng đầy đủ", diem: max, sao_toi_thieu: null },
    ],
  };
}

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n");
  wardId = (await t.app.org.listWards())[0]!.id;
  f = fixtures(t, () => wardId);
  t.clock.set(START);
  const admin = await f.admin();
  const { versionId } = await t.app.criteria.importVersion(admin, { fileName: "tieu-chi.json", content: VERSION });
  await t.app.criteria.publishVersion(admin, { versionId });
  const version = await t.app.criteria.getVersion(admin, { versionId });
  setId = version.productGroups[0]!.subgroups[0]!.sets[0]!.id;
  ward = await f.staff("ward_officer", wardId);
  province = await f.staff("province_officer");
  A = await f.staffedCouncil(province, { members: 2, advisors: 3 });
  [leader, colleague] = A.advisors as [UserActor, UserActor];
  await t.app.councils.setLeader(province, { councilId: A.councilId, userId: leader.userId });
  const roundId = await f.openRound(versionId, { gradingMode: "advisory_based", minGraders: 2 });
  await t.app.rounds.assignCouncil(province, { roundId, councilId: A.councilId });
});
beforeEach(() => t.clock.set(START));
afterAll(async () => {
  await t.stop();
  await db.drop();
});

/** A hồ sơ in Tổ tư vấn thẩm định, Phân công to both thành viên chấm and to the Tổ trưởng and one colleague. */
const underReview = () => f.gradingStarted(ward, province, setId, A.secretary, { members: A.members, advisors: [leader, colleague] });
const report = (actor: UserActor, dossierId: string) => t.app.scoring.advisoryReport(actor, { dossierId });

/** One line per Tiêu chí code, at the Mức điểm with these points. */
async function lines(actor: UserActor, dossierId: string, picks: Record<string, { points: number; basis?: string }>): Promise<AdvisoryReportLineInput[]> {
  const { criteria } = await report(actor, dossierId);
  return Object.entries(picks).map(([code, pick]) => {
    const c = criteria.find((x) => x.code === code)!;
    return {
      criterionId: c.criterionId,
      levelId: c.levels.find((l) => l.points === pick.points)!.id,
      basis: pick.basis ?? `Căn cứ ${code}`,
      evidenceFileIds: [],
      evidenceAssessment: "sufficient",
    };
  });
}

describe("L10 TM-02, TM-05, TM-06 Báo cáo Tổ tư vấn nháp (stories 44 to 47, 49, 50)", () => {
  it("is written together: a colleague sees and changes the nháp the other saved, with the estimate summed by Phần", async () => {
    const d = await underReview();
    const empty = await report(leader, d.dossierId);
    expect(empty).toMatchObject({ draftVersion: 0, summary: "", notes: "", missing: ["1.1", "1.2", "2.1"], estimate: { total: 0 } });
    expect(empty.criteria.map((c) => [c.code, c.partCode, c.maxPoints])).toEqual([
      ["1.1", "A", 40],
      ["1.2", "A", 20],
      ["2.1", "B", 40],
    ]);

    const saved = await t.app.scoring.saveAdvisoryDraft(leader, {
      dossierId: d.dossierId,
      draftVersion: 0,
      lines: await lines(leader, d.dossierId, { "1.1": { points: 40 }, "2.1": { points: 20 } }),
      summary: "Hồ sơ đầy đủ",
      notes: "Lưu ý nhãn mác",
      attachmentFileIds: [],
    });
    expect(saved).toEqual({ draftVersion: 1 });

    const seen = await report(colleague, d.dossierId);
    expect(seen).toMatchObject({ draftVersion: 1, summary: "Hồ sơ đầy đủ", notes: "Lưu ý nhãn mác", missing: ["1.2"] });
    expect(seen.estimate).toMatchObject({ parts: [{ code: "A", total: 40 }, { code: "B", total: 20 }], total: 60, star: 3 });
    expect(seen.criteria.find((c) => c.code === "1.1")!.line).toMatchObject({ points: 40, basis: "Căn cứ 1.1", evidenceAssessment: "sufficient" });

    await t.app.scoring.saveAdvisoryDraft(colleague, {
      dossierId: d.dossierId,
      draftVersion: 1,
      lines: await lines(colleague, d.dossierId, { "1.1": { points: 40 }, "1.2": { points: 10 }, "2.1": { points: 20 } }),
      summary: "Hồ sơ đầy đủ, đã xem lại",
      notes: "",
      attachmentFileIds: [],
    });
    expect(await report(leader, d.dossierId)).toMatchObject({ draftVersion: 2, missing: [], estimate: { total: 70 }, updatedBy: { userId: colleague.userId } });
  });

  it("refuses the later of two saves from the same nháp version, so nobody overwrites a colleague silently (story 50)", async () => {
    const d = await underReview();
    const content = { dossierId: d.dossierId, lines: [], summary: "", notes: "", attachmentFileIds: [] };
    await t.app.scoring.saveAdvisoryDraft(leader, { ...content, draftVersion: 0, summary: "Bản của Tổ trưởng" });

    await expect(t.app.scoring.saveAdvisoryDraft(colleague, { ...content, draftVersion: 0, summary: "Bản của đồng nghiệp" })).rejects.toMatchObject({
      code: "version_conflict",
    });
    expect((await report(colleague, d.dossierId)).summary).toBe("Bản của Tổ trưởng");
  });
});
