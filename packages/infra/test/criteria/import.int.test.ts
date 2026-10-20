import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonymous, createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
let qd26: string;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const PASSWORD = "mat-khau-can-bo-1";
const QD26_FILE = path.resolve(import.meta.dirname, "../../../../docs/tieu-chi/ocop_tieu_chi_qd26_2026.json");

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  qd26 = await readFile(QD26_FILE, "utf8");
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

const admin = () => t.signInAs(ADMIN.email, ADMIN.password);

/** A province officer created through the real activation flow. */
async function provinceOfficer(email: string) {
  const a = await admin();
  const { userId } = await t.app.identity.createStaffUser(a, { email, fullName: "Cán Bộ Sở" });
  await t.drainJobs();
  const token = /kich-hoat\?token=([\w-]+)/.exec(t.mailbox.to(email).at(-1)!.text)![1]!;
  await t.app.identity.activateAccount(anonymous(), { token, password: PASSWORD });
  await t.app.identity.grantRole(a, { userId, role: "province_officer", scopeId: null });
  return t.signInAs(email, PASSWORD);
}

/** The smallest file the importer accepts: one Bộ tiêu chí with one Tiêu chí; `over` patches it. */
function tinyFile(over: { set?: Record<string, unknown>; criterion?: Record<string, unknown>; root?: Record<string, unknown> } = {}) {
  return JSON.stringify({
    van_ban: "99/2027/QĐ-TTg",
    ngay_ban_hanh: "2027-01-02",
    hieu_luc: "2027-02-01",
    bo_tieu_chi: [
      {
        bo: 1,
        ten_bo: "Bộ thử",
        san_pham: "Nhóm thử",
        nhom: "Phân nhóm thử",
        ghi_chu_dau_phieu: "",
        tong_diem: 3,
        tieu_chi: [
          {
            phan: "A",
            phan_ten: "PHẦN THỬ",
            phan_diem: 3,
            muc: "1",
            muc_ten: "MỤC THỬ",
            muc_diem: 3,
            ma: "1.1",
            ten: "Tiêu chí thử",
            diem_toi_da: 3,
            yeu_cau: "",
            ghi_chu: "",
            lua_chon: [{ thu_tu: 1, mo_ta: "Đạt", diem: 3, sao_toi_thieu: null }],
            ...over.criterion,
          },
        ],
        ...over.set,
      },
    ],
    ...over.root,
  });
}

describe("L19 AD-03 nhập Phiên bản tiêu chí QĐ 26", () => {
  let versionId: string;

  it("creates a draft with the legal basis, its dates and the default Ngưỡng hạng", async () => {
    const a = await admin();
    ({ versionId } = await t.app.criteria.importVersion(a, { fileName: "ocop_tieu_chi_qd26_2026.json", content: qd26 }));

    const version = await t.app.criteria.getVersion(a, { versionId });
    expect(version).toMatchObject({
      id: versionId,
      status: "draft",
      legalBasis: "26/2026/QĐ-TTg",
      issuedOn: "2026-05-22",
      effectiveOn: "2026-05-22",
      publishedAt: null,
      copiedFrom: null,
    });
    expect(version.thresholds).toEqual([
      { stars: 2, minScore: 30 },
      { stars: 3, minScore: 50 },
      { stars: 4, minScore: 70 },
      { stars: 5, minScore: 90 },
    ]);
  });
});
