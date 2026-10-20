import type { CriteriaSetDetail, StoredCriterion } from "@ocop/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonymous, createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const PASSWORD = "mat-khau-can-bo-1";

const admin = () => t.signInAs(ADMIN.email, ADMIN.password);

/*
 * A Bộ tiêu chí of 100 points with two Tiêu chí, Ngưỡng hạng 30/50/70/90 (QĐ 26 defaults):
 *   A 1.1 (60): 0 · 30 · 60 with Sao tối thiểu 4 sao
 *   B 2.1 (40): 0 · 20 with Sao tối thiểu 3 sao · 40
 */
const criterion = (phan: string, phan_diem: number, ma: string, levels: { mo_ta: string; diem: number; sao_toi_thieu: number | null }[]) => ({
  phan,
  phan_ten: `PHẦN ${phan}`,
  phan_diem,
  muc: ma.split(".")[0],
  muc_ten: `MỤC ${ma}`,
  muc_diem: phan_diem,
  ma,
  ten: `Tiêu chí ${ma}`,
  diem_toi_da: phan_diem,
  yeu_cau: "",
  ghi_chu: "",
  lua_chon: levels.map((l, i) => ({ thu_tu: i + 1, ...l })),
});

const FILE = JSON.stringify({
  van_ban: "98/2027/QĐ-TTg",
  ngay_ban_hanh: "2027-01-02",
  hieu_luc: "2027-02-01",
  bo_tieu_chi: [
    {
      bo: 1,
      ten_bo: "Bộ chấm thử",
      san_pham: "Nhóm thử",
      nhom: "Phân nhóm thử",
      ghi_chu_dau_phieu: "",
      tong_diem: 100,
      tieu_chi: [
        criterion("A", 60, "1.1", [
          { mo_ta: "Không có", diem: 0, sao_toi_thieu: null },
          { mo_ta: "Một phần", diem: 30, sao_toi_thieu: null },
          { mo_ta: "Đầy đủ", diem: 60, sao_toi_thieu: 4 },
        ]),
        criterion("B", 40, "2.1", [
          { mo_ta: "Không có", diem: 0, sao_toi_thieu: null },
          { mo_ta: "Cơ bản", diem: 20, sao_toi_thieu: 3 },
          { mo_ta: "Tốt", diem: 40, sao_toi_thieu: null },
        ]),
      ],
    },
  ],
});

let set: CriteriaSetDetail;
const criteria = () => set.parts.flatMap((p) => p.sections.flatMap((s) => s.items.flatMap((i) => (i.kind === "group" ? i.criteria : [i])))) as StoredCriterion[];
/** The id of the Mức điểm worth `points` on Tiêu chí `code`. */
const level = (code: string, points: number) => criteria().find((c) => c.code === code)!.levels.find((l) => l.points === points)!.id;

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  const a = await admin();
  const { versionId } = await t.app.criteria.importVersion(a, { fileName: "cham-thu.json", content: FILE });
  const setId = (await t.app.criteria.getVersion(a, { versionId })).productGroups[0]!.subgroups[0]!.sets[0]!.id;
  set = (await t.app.criteria.getCriteriaSet(a, { setId })).set;
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("L19 AD-03 xem trước Bộ tiêu chí bằng chấm thử", () => {
  it("ranks the chosen Mức điểm: Phần totals, total, rank by Ngưỡng hạng and by Sao tối thiểu", async () => {
    const result = await t.app.criteria.previewSet(await admin(), { setId: set.id, levelIds: [level("1.1", 60), level("2.1", 20)] });
    expect(result).toEqual({
      parts: [
        { code: "A", total: 60 },
        { code: "B", total: 20 },
      ],
      total: 80,
      byThreshold: 4,
      byMinimumStars: 5,
      star: 4,
      unmet: [],
    });
  });

  it("caps the Hạng sao at the Sao tối thiểu a Tiêu chí misses and reports it", async () => {
    const result = await t.app.criteria.previewSet(await admin(), { setId: set.id, levelIds: [level("1.1", 30), level("2.1", 40)] });
    expect(result).toMatchObject({ total: 70, byThreshold: 4, byMinimumStars: 3, star: 3 });
    expect(result.unmet).toEqual([{ code: "1.1", name: "Tiêu chí 1.1", star: 4, required: 60, actual: 30 }]);
  });

  it("scores 0 for a Tiêu chí without a chosen Mức điểm", async () => {
    const result = await t.app.criteria.previewSet(await admin(), { setId: set.id, levelIds: [level("1.1", 60)] });
    expect(result).toMatchObject({ total: 60, byThreshold: 3, byMinimumStars: 2, star: 2 });
    expect(result.unmet).toEqual([{ code: "2.1", name: "Tiêu chí 2.1", star: 3, required: 20, actual: 0 }]);
  });

  it("refuses a Mức điểm of another Bộ tiêu chí or an unknown id", async () => {
    const a = await admin();
    const { versionId } = await t.app.criteria.importVersion(a, { fileName: "khac.json", content: FILE.replace("98/2027", "97/2027") });
    const otherSetId = (await t.app.criteria.getVersion(a, { versionId })).productGroups[0]!.subgroups[0]!.sets[0]!.id;
    const otherLevel = (await t.app.criteria.getCriteriaSet(a, { setId: otherSetId })).set.parts[0]!.sections[0]!.items[0] as StoredCriterion;

    await expect(t.app.criteria.previewSet(a, { setId: set.id, levelIds: [otherLevel.levels[1]!.id] })).rejects.toMatchObject({ code: "level_not_in_set" });
    await expect(t.app.criteria.previewSet(a, { setId: set.id, levelIds: ["00000000-0000-7000-8000-000000000000"] })).rejects.toMatchObject({
      code: "level_not_in_set",
    });
  });

  it("refuses two Mức điểm for one Tiêu chí", async () => {
    await expect(t.app.criteria.previewSet(await admin(), { setId: set.id, levelIds: [level("1.1", 30), level("1.1", 60)] })).rejects.toMatchObject({
      code: "one_level_per_criterion",
    });
  });

  it("reports an unknown Bộ tiêu chí as not found", async () => {
    await expect(t.app.criteria.previewSet(await admin(), { setId: "00000000-0000-7000-8000-000000000000", levelIds: [] })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("writes nothing: no audit row and no event", async () => {
    const a = await admin();
    await t.drainJobs();
    const countRows = async () => {
      const { rows } = await db.admin.query<{ audit: number; outbox: number }>(
        "SELECT (SELECT count(*)::int FROM platform.audit_log) AS audit, (SELECT count(*)::int FROM platform.outbox) AS outbox",
      );
      return rows[0];
    };
    const before = await countRows();
    await t.app.criteria.previewSet(a, { setId: set.id, levelIds: [level("1.1", 60), level("2.1", 40)] });
    expect(await countRows()).toEqual(before);
  });

  it("is for Quản trị only", async () => {
    const a = await admin();
    const email = "can-bo-so@tinh.gov.vn";
    const { userId } = await t.app.identity.createStaffUser(a, { email, fullName: "Cán Bộ Sở" });
    await t.drainJobs();
    const token = /kich-hoat\?token=([\w-]+)/.exec(t.mailbox.to(email).at(-1)!.text)![1]!;
    await t.app.identity.activateAccount(anonymous(), { token, password: PASSWORD });
    await t.app.identity.grantRole(a, { userId, role: "province_officer", scopeId: null });
    const officer = await t.signInAs(email, PASSWORD);

    await expect(t.app.criteria.previewSet(officer, { setId: set.id, levelIds: [] })).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.criteria.previewSet(anonymous(), { setId: set.id, levelIds: [] })).rejects.toMatchObject({ code: "forbidden" });
  });
});
