import { afterAll, beforeAll, beforeEach } from "vitest";
import type { GradingMode, UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "../dossiers/fixtures";

export const START = new Date("2026-10-19T02:00:00Z");

/** A Bộ tiêu chí with one Tiêu chí per Phần: 1.1 (A, 40, Sao tối thiểu 3 at 20), 2.1 (B, 25), 3.1 (C, 35). */
const criterion = (phan: "A" | "B" | "C", points: number, ma: string, levels: { mo_ta: string; diem: number; sao_toi_thieu: number | null }[]) => ({
  phan,
  phan_ten: `PHẦN ${phan}`,
  phan_diem: points,
  muc: { A: "1", B: "2", C: "3" }[phan],
  muc_ten: `MỤC ${phan}`,
  muc_diem: points,
  ma,
  ten: `Tiêu chí ${ma}`,
  diem_toi_da: points,
  yeu_cau: "",
  ghi_chu: "",
  lua_chon: levels.map((l, i) => ({ thu_tu: i + 1, ...l })),
});
/** With `fiveStarMinimum`, 1.1 "Đầy đủ" (40) is also the Sao tối thiểu of 5 sao. */
const criteriaOf = (fiveStarMinimum: boolean) => [
  criterion("A", 40, "1.1", [
    { mo_ta: "Một phần", diem: 20, sao_toi_thieu: 3 },
    { mo_ta: "Đầy đủ", diem: 40, sao_toi_thieu: fiveStarMinimum ? 5 : null },
  ]),
  criterion("B", 25, "2.1", [{ mo_ta: "Đạt", diem: 25, sao_toi_thieu: null }]),
  criterion("C", 35, "3.1", [{ mo_ta: "Đạt", diem: 35, sao_toi_thieu: null }]),
];

export interface ScoringWorld {
  db: TestDatabase;
  t: TestApp;
  f: ReturnType<typeof fixtures>;
  setId: string;
  roundId: string;
  ward: UserActor;
  province: UserActor;
  A: Awaited<ReturnType<ReturnType<typeof fixtures>["staffedCouncil"]>>;
  B: Awaited<ReturnType<ReturnType<typeof fixtures>["staffedCouncil"]>>;
  /** Mức điểm id by "<mã tiêu chí>:<điểm>", e.g. "1.1:20", "2.1:0". */
  level: (key: string) => string;
  criterionId: (code: string) => string;
  /** A hồ sơ Giao chấm in the world's đợt to these thành viên chấm of Hội đồng A. */
  graded: (members: UserActor[], advisors?: UserActor[]) => Promise<{ a: UserActor; dossierId: string; version: number; state: string }>;
}

/**
 * One database for a describe: Hội đồng A (4 thành viên, `advisors` Tổ tư vấn, default 1) and B (2, 1); a đợt Đang nhận nộp on a
 * three-Tiêu chí Bộ tiêu chí, gán to A, with `gradingMode` (chấm trực tiếp), `minGraders` (2) and `fiveStarMinimum` (no).
 */
export function scoringWorld(opts: { gradingMode?: GradingMode; minGraders?: number; totpRequired?: boolean; advisors?: number; fiveStarMinimum?: boolean } = {}): ScoringWorld {
  const w = {} as ScoringWorld;
  beforeAll(async () => {
    w.db = await createTestDatabase();
    w.t = createTestApp(w.db, { totpRequired: opts.totpRequired ?? false });
    await w.t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
    await seedWards(w.db.app, "ma,ten\n00001,Xã An Phú\n");
    const wardId = (await w.t.app.org.listWards())[0]!.id;
    w.f = fixtures(w.t, () => wardId);
    w.t.clock.set(START);
    const admin = await w.f.admin();
    const set = (bo: number, ten_bo: string) => ({ bo, ten_bo, san_pham: "Thực phẩm", nhom: "Thực phẩm tươi sống", ghi_chu_dau_phieu: "", tong_diem: 100, tieu_chi: criteriaOf(opts.fiveStarMinimum ?? false) });
    const content = JSON.stringify({ van_ban: "26/2026/QĐ-TTg", ngay_ban_hanh: "2026-01-02", hieu_luc: "2026-02-01", bo_tieu_chi: [set(1, "Rau củ quả")] });
    const { versionId } = await w.t.app.criteria.importVersion(admin, { fileName: "tieu-chi.json", content });
    await w.t.app.criteria.publishVersion(admin, { versionId });
    const version = await w.t.app.criteria.getVersion(admin, { versionId });
    w.setId = version.productGroups[0]!.subgroups[0]!.sets[0]!.id;
    const detail = await w.t.app.criteria.getCriteriaSet(admin, { setId: w.setId });
    const criteria = detail.set.parts.flatMap((p) => p.sections.flatMap((s) => s.items.flatMap((i) => (i.kind === "criterion" ? [i] : i.criteria))));
    const levels = new Map<string, string>(criteria.flatMap((c) => c.levels.map((l) => [`${c.code}:${l.points}`, l.id] as const)));
    const ids = new Map(criteria.map((c) => [c.code, c.id]));
    w.level = (key) => {
      const id = levels.get(key);
      if (!id) throw new Error(`no level ${key}`);
      return id;
    };
    w.criterionId = (code) => ids.get(code)!;
    w.ward = await w.f.staff("ward_officer", wardId);
    w.province = await w.f.staff("province_officer");
    w.A = await w.f.staffedCouncil(w.province, { members: 4, advisors: opts.advisors ?? 1 });
    w.B = await w.f.staffedCouncil(w.province, { members: 2, advisors: 1 });
    w.roundId = await w.f.openRound(versionId, { gradingMode: opts.gradingMode ?? "direct", minGraders: opts.minGraders ?? 2 });
    await w.t.app.rounds.assignCouncil(w.province, { roundId: w.roundId, councilId: w.A.councilId });
    w.graded = (members, advisors = []) => w.f.gradingStarted(w.ward, w.province, w.setId, w.A.secretary, { members, advisors });
  });
  beforeEach(() => {
    w.t.clock.set(START);
  });
  afterAll(async () => {
    await w.t.stop();
    await w.db.drop();
  });
  return w;
}
