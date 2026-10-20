import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedCriteria } from "../../src/seed/criteria";
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
    expect(version.thresholds).toEqual({ 2: 30, 3: 50, 4: 70, 5: 90 });
  });

  it("builds the Cây phân loại of the file: 6 Nhóm sản phẩm, their Phân nhóm and all 26 Bộ tiêu chí", async () => {
    const version = await t.app.criteria.getVersion(await admin(), { versionId });
    expect(version.productGroups.map((g) => g.name)).toEqual([
      "Thực phẩm",
      "Đồ uống",
      "Dược liệu",
      "Hàng thủ công mỹ nghệ",
      "Sinh vật cảnh",
      "Dịch vụ du lịch cộng đồng, du lịch sinh thái và điểm du lịch",
    ]);
    const food = version.productGroups[0]!;
    expect(food.subgroups.map((s) => s.name)).toEqual([
      "Thực phẩm tươi sống",
      "Thực phẩm thô, sơ chế",
      "Thực phẩm chế biến",
      "Nông sản chế biến",
      "Gia vị",
      "Chè",
      "Cà phê, Ca cao",
    ]);
    expect(food.subgroups[0]!.sets.map((b) => [b.code, b.name])).toEqual([
      ["1", "Rau, củ, quả, hạt tươi"],
      ["2", "Thịt, thủy sản, trứng, sữa tươi"],
    ]);
    const sets = version.productGroups.flatMap((g) => g.subgroups.flatMap((s) => s.sets));
    expect(sets.map((b) => b.code)).toEqual(Array.from({ length: 26 }, (_, i) => String(i + 1)));
    expect(sets.every((b) => b.totalPoints === 100)).toBe(true);
    expect(sets.find((b) => b.code === "1")!.criterionCount).toBe(32);
    expect(sets.reduce((n, b) => n + b.criterionCount, 0)).toBe(787);

    const list = await t.app.criteria.listVersions(await admin());
    expect(list).toEqual([expect.objectContaining({ id: versionId, status: "draft", legalBasis: "26/2026/QĐ-TTg", setCount: 26 })]);
  });

  it("puts a Bộ with an empty `nhom` in a Phân nhóm of its own name", async () => {
    const version = await t.app.criteria.getVersion(await admin(), { versionId });
    const ornamental = version.productGroups.find((g) => g.name === "Sinh vật cảnh")!;
    expect(ornamental.subgroups.map((s) => [s.name, s.sets.map((b) => b.code)])).toEqual([
      ["Hoa", ["23"]],
      ["Cây cảnh", ["24"]],
      ["Động vật cảnh", ["25"]],
    ]);
    const tourism = version.productGroups.at(-1)!;
    expect(tourism.subgroups).toEqual([
      expect.objectContaining({ name: "Dịch vụ du lịch cộng đồng, du lịch sinh thái và điểm du lịch", sets: [expect.objectContaining({ code: "26" })] }),
    ]);
  });

  async function set(code: string) {
    const a = await admin();
    const version = await t.app.criteria.getVersion(a, { versionId });
    const id = version.productGroups.flatMap((g) => g.subgroups.flatMap((s) => s.sets)).find((b) => b.code === code)!.id;
    return (await t.app.criteria.getCriteriaSet(a, { setId: id })).set;
  }
  const criteriaIn = (s: Awaited<ReturnType<typeof set>>) =>
    s.parts.flatMap((p) => p.sections.flatMap((sec) => sec.items.flatMap((i) => (i.kind === "group" ? i.criteria : [i]))));
  const criterionOf = async (setCode: string, code: string) => criteriaIn(await set(setCode)).find((c) => c.code === code)!;
  const levels = (c: { levels: readonly { description: string; points: number; minimumStar: unknown; branch: unknown; systemAdded: boolean }[] }) =>
    c.levels.map((l) => ({ description: l.description, points: l.points, minimumStar: l.minimumStar, branch: l.branch, systemAdded: l.systemAdded }));

  it("shows a Bộ tiêu chí as Phần → Mục → Tiêu chí in sheet order, with its declared points", async () => {
    const s = await set("1");
    expect(s).toMatchObject({ code: "1", name: "Rau, củ, quả, hạt tươi", totalPoints: 100, sourcePages: [18, 22] });
    expect(s.parts.map((p) => [p.code, p.name, p.points])).toEqual([
      ["A", "SẢN PHẨM VÀ SỨC MẠNH CỦA CỘNG ĐỒNG", 40],
      ["B", "KHẢ NĂNG TIẾP THỊ", 25],
      ["C", "CHẤT LƯỢNG SẢN PHẨM", 35],
    ]);
    expect(s.parts[0]!.sections[0]).toMatchObject({ code: "1", name: "TỔ CHỨC SẢN XUẤT", points: 18 });
    expect(criteriaIn(s).slice(0, 3).map((c) => [c.code, c.name, c.maxPoints])).toEqual([
      ["1.1", "Nguồn gốc sản phẩm", 3],
      ["1.2", "Vùng nguyên liệu được cấp chứng nhận chất lượng", 2],
      ["1.3", "Gia tăng giá trị", 3],
    ]);
    expect(criteriaIn(s)[0]!.requirement).toBe("Yêu cầu: 100% sản phẩm được trồng trên địa bàn cấp tỉnh");
  });

  it("imports a single-line Tiêu chí (empty lua_chon) as two levels, 0 points and full points", async () => {
    expect(levels(await criterionOf("1", "2.4"))).toEqual([
      { description: "Không đáp ứng", points: 0, minimumStar: null, branch: null, systemAdded: true },
      { description: "Đáp ứng", points: 1, minimumStar: null, branch: null, systemAdded: false },
    ]);
    expect((await criterionOf("21", "2.3")).levels.map((l) => l.points)).toEqual([0, 1]);
  });

  it("adds a marked 'Không đáp ứng, 0 điểm' level only where the text has no 0-point level", async () => {
    expect(levels(await criterionOf("1", "1.1"))).toEqual([
      { description: "Không đáp ứng", points: 0, minimumStar: null, branch: null, systemAdded: true },
      { description: "Sản phẩm được trồng trên địa bàn cấp xã, nhưng có tỷ lệ dưới 50%", points: 1, minimumStar: null, branch: null, systemAdded: false },
      { description: "Sản phẩm được trồng trên địa bàn cấp xã từ 50% đến dưới 75%", points: 2, minimumStar: null, branch: null, systemAdded: false },
      { description: "Sản phẩm được trồng trên địa bàn cấp xã từ 75% đến 100%", points: 3, minimumStar: null, branch: null, systemAdded: false },
    ]);
    const c12 = await criterionOf("1", "1.2");
    expect(c12.levels.map((l) => [l.points, l.systemAdded])).toEqual([
      [0, false],
      [1, false],
      [2, false],
    ]);
    expect(c12.levels[0]!.description).toBe("Không được cấp giấy chứng nhận chất lượng");
  });

  it("keeps Sao tối thiểu on the Mức điểm (tiêu chí 1.5 of bộ 1: **** at 2 points, ***** at 3)", async () => {
    expect((await criterionOf("1", "1.5")).levels.map((l) => [l.points, l.minimumStar])).toEqual([
      [0, null],
      [1, null],
      [2, 4],
      [3, 5],
    ]);
  });

  it("labels the a/b branches of tiêu chí 8, 9 and 15 of bộ 26", async () => {
    for (const code of ["8", "9", "15"]) {
      const c = await criterionOf("26", code);
      expect(c.levels.map((l) => l.branch)).toEqual([null, "a", "a", "b", "b"]);
      expect(c.levels[0]).toMatchObject({ points: 0, systemAdded: true });
    }
    expect((await criterionOf("26", "8")).levels.map((l) => l.points)).toEqual([0, 1, 3, 1, 3]);
    const others = criteriaIn(await set("26")).filter((c) => !["8", "9", "15"].includes(c.code));
    expect(others.flatMap((c) => c.levels).every((l) => l.branch === null)).toBe(true);
  });

  it("nests Nhóm tiêu chí under their Mục, from either nhom_ma/nhom_ten/nhom_diem or the nhom_con label", async () => {
    const tea = (await set("11")).parts[2]!.sections.find((s) => s.code === "6")!;
    expect(tea.items.map((i) => (i.kind === "group" ? [i.code, i.name, i.points, i.criteria.map((c) => c.code)] : i.code))).toEqual([
      ["6.1", "Ngoại hình", 4, ["6.1.1", "6.1.2"]],
      ["6.2", "Nước pha", 11, ["6.2.1", "6.2.2", "6.2.3"]],
    ]);
    const coffee = (await set("13")).parts[2]!.sections.find((s) => s.code === "6")!;
    expect(coffee.items.map((i) => (i.kind === "group" ? [i.code, i.name, i.points, i.criteria.length] : i.code))).toEqual([
      ["6.1", "Ngoại hình", 10, 5],
      ["6.2", "Nước pha", 5, 2],
    ]);
  });

  it("splits 'Hồ sơ bị loại khi…' into Điều kiện loại", async () => {
    expect((await set("1")).exclusionConditions.map((e) => e.description)).toEqual([
      "Giả mạo hồ sơ",
      "Không tuân thủ đầy đủ các quy định về giấy chứng nhận cơ sở đủ điều kiện an toàn thực phẩm theo quy định",
      "Không đáp ứng về hồ sơ đăng ký theo quy định",
    ]);
    expect((await set("19")).exclusionConditions.map((e) => e.description)).toEqual([
      "Giả mạo hồ sơ",
      "Không có đủ điều kiện bắt buộc để sản xuất sản phẩm theo quy định quản lý chuyên ngành của Bộ Y tế",
      "Không có Bản công bố sản phẩm (hoặc tương đương)",
      "Không đáp ứng về Hồ sơ đăng ký theo quy định",
    ]);
    // Bộ 26 prints no such line.
    expect((await set("26")).exclusionConditions).toEqual([]);
  });

  it("keeps the extraction notes for review", async () => {
    expect((await set("26")).extractionNote).toMatch(/Phần A ở tiêu đề là '\(35 Điểm\)'/);
    expect((await criterionOf("26", "8")).extractionNote).toMatch(/Hai nhánh a\/b/);
    expect((await set("10")).footerNote).toMatch(/Dấu sao là yêu cầu tối thiểu/);
  });

  it("records the import in the audit log and the outbox", async () => {
    const [entry] = await t.app.audit.search(await admin(), { action: ["criteria.version.imported"], targetId: versionId });
    expect(entry).toMatchObject({
      actorRole: "admin",
      targetType: "criteria_version",
      after: { legalBasis: "26/2026/QĐ-TTg", status: "draft" },
      metadata: { fileName: "ocop_tieu_chi_qd26_2026.json", sets: 26, criteria: 787 },
    });
    const { rows } = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'criteria.version.imported'");
    expect(rows).toEqual([{ payload: { versionId } }]);
  });
});

describe("L19 AD-03 tệp sai định dạng", () => {
  const importing = async (content: string) => t.app.criteria.importVersion(await admin(), { fileName: "sai.json", content });

  async function nothingCreated(run: () => Promise<unknown>) {
    const before = (await t.app.criteria.listVersions(await admin())).length;
    const err = await run().then(
      () => null,
      (e: unknown) => e,
    );
    expect((await t.app.criteria.listVersions(await admin())).length).toBe(before);
    return err as { code: string; message: string; issues: { location: string; message: string }[] };
  }

  it("refuses text that is not JSON", async () => {
    const err = await nothingCreated(() => importing("{ not json"));
    expect(err).toMatchObject({ code: "invalid_criteria_file" });
    expect(err.issues[0]!.message).toMatch(/JSON/);
  });

  it("lists every problem with its location and creates nothing", async () => {
    const content = tinyFile({
      root: { ngay_ban_hanh: "22/05/2026" },
      criterion: { lua_chon: [{ thu_tu: 1, mo_ta: "Đạt", diem: "ba", sao_toi_thieu: 6 }] },
    });
    const err = await nothingCreated(() => importing(content));
    expect(err.code).toBe("invalid_criteria_file");
    expect(err.issues.map((i) => i.location)).toEqual(
      expect.arrayContaining(["ngay_ban_hanh", "Bộ 1 › tiêu chí 1.1 › lua_chon[0].diem", "Bộ 1 › tiêu chí 1.1 › lua_chon[0].sao_toi_thieu"]),
    );
    expect(err.message).toMatch(/Bộ 1 › tiêu chí 1.1 › lua_chon\[0\]\.diem/);
  });

  it("refuses a Mục declared differently by two Tiêu chí", async () => {
    const content = JSON.parse(tinyFile()) as { bo_tieu_chi: { tieu_chi: Record<string, unknown>[] }[] };
    const first = content.bo_tieu_chi[0]!.tieu_chi[0]!;
    content.bo_tieu_chi[0]!.tieu_chi.push({ ...first, ma: "1.2", muc_diem: 5 });
    const err = await nothingCreated(() => importing(JSON.stringify(content)));
    expect(err.issues).toEqual([{ location: "Bộ 1 › tiêu chí 1.2 › muc_diem", message: "Mục 1 khai báo khác nhau giữa các tiêu chí" }]);
  });

  it("refuses levels where only some carry a branch label", async () => {
    const content = tinyFile({
      criterion: {
        lua_chon: [
          { thu_tu: 1, mo_ta: "a. Trường hợp một", diem: 3, sao_toi_thieu: null },
          { thu_tu: 2, mo_ta: "Không nhãn", diem: 1, sao_toi_thieu: null },
        ],
      },
    });
    const err = await nothingCreated(() => importing(content));
    expect(err.issues.map((i) => i.location)).toEqual(["Bộ 1 › tiêu chí 1.1 › lua_chon"]);
  });

  it("accepts the smallest valid file as a draft", async () => {
    const { versionId } = await importing(tinyFile());
    const version = await t.app.criteria.getVersion(await admin(), { versionId });
    expect(version).toMatchObject({ legalBasis: "99/2027/QĐ-TTg", issuedOn: "2027-01-02", effectiveOn: "2027-02-01", status: "draft" });
  });
});

describe("L19 AD-03 phân quyền", () => {
  it("only Quản trị imports a version, and only Quản trị sees drafts", async () => {
    const officer = await provinceOfficer("so@tinh.gov.vn");
    await expect(t.app.criteria.importVersion(officer, { fileName: "x.json", content: tinyFile() })).rejects.toMatchObject({ code: "forbidden" });

    const [draft] = await t.app.criteria.listVersions(await admin());
    expect(await t.app.criteria.listVersions(officer)).toEqual([]);
    await expect(t.app.criteria.getVersion(officer, { versionId: draft!.id })).rejects.toMatchObject({ code: "not_found" });
    const setId = (await t.app.criteria.getVersion(await admin(), { versionId: draft!.id })).productGroups[0]!.subgroups[0]!.sets[0]!.id;
    await expect(t.app.criteria.getCriteriaSet(officer, { setId })).rejects.toMatchObject({ code: "not_found" });
  });

  it("refuses visitors who are not signed in", async () => {
    await expect(t.app.criteria.listVersions(anonymous())).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.criteria.importVersion(anonymous(), { fileName: "x.json", content: tinyFile() })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("L19 seed QĐ 26", () => {
  it("imports the QĐ 26 file as a draft once, as the system", async () => {
    const fresh = await createTestDatabase();
    const t2 = createTestApp(fresh, { totpRequired: false });
    try {
      await t2.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
      expect(await seedCriteria(fresh.app, t2.app, qd26, "ocop_tieu_chi_qd26_2026.json")).toMatchObject({ created: true });
      expect(await seedCriteria(fresh.app, t2.app, qd26, "ocop_tieu_chi_qd26_2026.json")).toMatchObject({ created: false });

      const a = await t2.signInAs(ADMIN.email, ADMIN.password);
      const versions = await t2.app.criteria.listVersions(a);
      expect(versions).toEqual([expect.objectContaining({ legalBasis: "26/2026/QĐ-TTg", status: "draft", setCount: 26, createdBy: null })]);
      const [entry] = await t2.app.audit.search(a, { action: ["criteria.version.imported"] });
      expect(entry).toMatchObject({ actorRole: "system:seed:criteria", targetId: versions[0]!.id });
    } finally {
      await t2.stop();
      await fresh.drop();
    }
  });
});
