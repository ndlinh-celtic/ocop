import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonymous, createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const PASSWORD = "mat-khau-can-bo-1";

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

const admin = () => t.signInAs(ADMIN.email, ADMIN.password);

/** A Cán bộ Sở, created through the real activation flow. */
async function officer(email: string) {
  const a = await admin();
  const { userId } = await t.app.identity.createStaffUser(a, { email, fullName: "Cán Bộ" });
  await t.drainJobs();
  const token = /kich-hoat\?token=([\w-]+)/.exec(t.mailbox.to(email).at(-1)!.text)![1]!;
  await t.app.identity.activateAccount(anonymous(), { token, password: PASSWORD });
  await t.app.identity.grantRole(a, { userId, role: "province_officer", scopeId: null });
  return t.signInAs(email, PASSWORD);
}

/** A Bộ tiêu chí of 100 điểm: Phần A › Mục 1 › Nhóm 1.1 › Tiêu chí 1.1.1 (two Mức điểm), plus one Điều kiện loại. */
const FILE = JSON.stringify({
  van_ban: "99/2027/QĐ-TTg",
  ngay_ban_hanh: "2027-01-02",
  hieu_luc: "2027-02-01",
  bo_tieu_chi: [
    {
      bo: 1,
      ten_bo: "Bộ thử",
      san_pham: "Nhóm thử",
      nhom: "Phân nhóm thử",
      ghi_chu_dau_phieu: "Hồ sơ bị loại khi: không có giấy phép",
      tong_diem: 100,
      tieu_chi: [
        {
          phan: "A",
          phan_ten: "PHẦN THỬ",
          phan_diem: 100,
          muc: "1",
          muc_ten: "MỤC THỬ",
          muc_diem: 100,
          nhom_ma: "1.1",
          nhom_ten: "Nhóm tiêu chí thử",
          nhom_diem: 100,
          ma: "1.1.1",
          ten: "Tiêu chí thử",
          diem_toi_da: 100,
          yeu_cau: "",
          ghi_chu: "",
          lua_chon: [
            { thu_tu: 1, mo_ta: "Chưa đạt", diem: 0, sao_toi_thieu: null },
            { thu_tu: 2, mo_ta: "Đạt", diem: 100, sao_toi_thieu: null },
          ],
        },
      ],
    },
  ],
});

/** A fresh draft and the ids of every node in it. */
async function draft() {
  const a = await admin();
  const { versionId } = await t.app.criteria.importVersion(a, { fileName: "thu.json", content: FILE });
  const tree = await t.app.criteria.getVersion(a, { versionId });
  const group = tree.productGroups[0]!;
  const subgroup = group.subgroups[0]!;
  const { set } = await t.app.criteria.getCriteriaSet(a, { setId: subgroup.sets[0]!.id });
  const part = set.parts[0]!;
  const section = part.sections[0]!;
  const criterionGroup = section.items[0]!;
  if (criterionGroup.kind !== "group") throw new Error("fixture has a Nhóm tiêu chí");
  const criterion = criterionGroup.criteria[0]!;
  return {
    a,
    versionId,
    ids: {
      productGroup: group.id,
      subgroup: subgroup.id,
      set: set.id,
      exclusion: set.exclusionConditions[0]!.id,
      part: part.id,
      section: section.id,
      criterionGroup: criterionGroup.id,
      criterion: criterion.id,
      scoreLevel: criterion.levels[1]!.id,
    },
  };
}

describe("L19 AD-03 sửa nội dung bản nháp", () => {
  it("edits the Văn bản căn cứ, Ngày ban hành and Ngày hiệu lực", async () => {
    const { a, versionId } = await draft();
    await t.app.criteria.editDraft(a, {
      versionId,
      edit: { node: "version", changes: { legalBasis: " 100/2027/QĐ-TTg ", issuedOn: "2027-03-04", effectiveOn: "2027-04-05" } },
    });
    expect(await t.app.criteria.getVersion(a, { versionId })).toMatchObject({
      legalBasis: "100/2027/QĐ-TTg",
      issuedOn: "2027-03-04",
      effectiveOn: "2027-04-05",
    });
  });

  it("edits the Ngưỡng hạng", async () => {
    const { a, versionId } = await draft();
    await t.app.criteria.editDraft(a, { versionId, edit: { node: "thresholds", changes: { 2: 35, 5: 92.5 } } });
    expect((await t.app.criteria.getVersion(a, { versionId })).thresholds).toEqual({ 2: 35, 3: 50, 4: 70, 5: 92.5 });
  });

  it("edits the name of a Nhóm sản phẩm and a Phân nhóm", async () => {
    const { a, versionId, ids } = await draft();
    await t.app.criteria.editDraft(a, { versionId, edit: { node: "productGroup", id: ids.productGroup, changes: { name: "Thực phẩm" } } });
    await t.app.criteria.editDraft(a, { versionId, edit: { node: "subgroup", id: ids.subgroup, changes: { name: "Thực phẩm tươi" } } });
    const g = (await t.app.criteria.getVersion(a, { versionId })).productGroups[0]!;
    expect([g.name, g.subgroups[0]!.name]).toEqual(["Thực phẩm", "Thực phẩm tươi"]);
  });

  it("edits the name and declared points of a Bộ tiêu chí, Phần, Mục and Nhóm tiêu chí", async () => {
    const { a, versionId, ids } = await draft();
    await t.app.criteria.editDraft(a, { versionId, edit: { node: "set", id: ids.set, changes: { name: "Bộ mới", totalPoints: 90 } } });
    await t.app.criteria.editDraft(a, { versionId, edit: { node: "part", id: ids.part, changes: { name: "PHẦN MỚI", points: 91 } } });
    await t.app.criteria.editDraft(a, { versionId, edit: { node: "section", id: ids.section, changes: { name: "MỤC MỚI", points: 92 } } });
    await t.app.criteria.editDraft(a, { versionId, edit: { node: "criterionGroup", id: ids.criterionGroup, changes: { name: "Nhóm mới", points: 93.25 } } });
    const { set } = await t.app.criteria.getCriteriaSet(a, { setId: ids.set });
    const part = set.parts[0]!;
    const section = part.sections[0]!;
    expect([set.name, set.totalPoints, part.name, part.points, section.name, section.points]).toEqual(["Bộ mới", 90, "PHẦN MỚI", 91, "MỤC MỚI", 92]);
    expect(section.items[0]).toMatchObject({ kind: "group", name: "Nhóm mới", points: 93.25 });
  });

  it("edits the mã, tên, yêu cầu, ghi chú and điểm tối đa of a Tiêu chí", async () => {
    const { a, versionId, ids } = await draft();
    const changes = { code: "1.1.9", name: "Tên mới", requirement: "Yêu cầu mới", note: "Ghi chú mới", maxPoints: 80 };
    await t.app.criteria.editDraft(a, { versionId, edit: { node: "criterion", id: ids.criterion, changes } });
    const { set } = await t.app.criteria.getCriteriaSet(a, { setId: ids.set });
    const group = set.parts[0]!.sections[0]!.items[0]!;
    expect(group.kind === "group" && group.criteria[0]).toMatchObject(changes);
  });

  it("edits the mô tả, điểm, Sao tối thiểu and nhãn nhánh of a Mức điểm", async () => {
    const { a, versionId, ids } = await draft();
    await t.app.criteria.editDraft(a, {
      versionId,
      edit: { node: "scoreLevel", id: ids.scoreLevel, changes: { description: "Đạt tốt", points: 90, minimumStar: 4, branch: " a " } },
    });
    const level = async () => {
      const { set } = await t.app.criteria.getCriteriaSet(a, { setId: ids.set });
      const group = set.parts[0]!.sections[0]!.items[0]!;
      return group.kind === "group" ? group.criteria[0]!.levels[1] : undefined;
    };
    expect(await level()).toMatchObject({ description: "Đạt tốt", points: 90, minimumStar: 4, branch: "a" });
    await t.app.criteria.editDraft(a, { versionId, edit: { node: "scoreLevel", id: ids.scoreLevel, changes: { minimumStar: null, branch: "" } } });
    expect(await level()).toMatchObject({ minimumStar: null, branch: null });
  });

  it("edits an Điều kiện loại", async () => {
    const { a, versionId, ids } = await draft();
    await t.app.criteria.editDraft(a, { versionId, edit: { node: "exclusion", id: ids.exclusion, changes: { description: "Không có giấy phép kinh doanh" } } });
    const { set } = await t.app.criteria.getCriteriaSet(a, { setId: ids.set });
    expect(set.exclusionConditions.map((e) => e.description)).toEqual(["Không có giấy phép kinh doanh"]);
  });

  it.each([
    ["points", { points: 10 }],
    ["description", { description: "Không có" }],
    ["Sao tối thiểu", { minimumStar: 3 }],
  ] as const)("makes a system-added 0-point Mức điểm Quản trị's own once its %s is edited", async (_label, changes) => {
    const a = await admin();
    const file = JSON.parse(FILE) as { bo_tieu_chi: { tieu_chi: { lua_chon: unknown[] }[] }[] };
    file.bo_tieu_chi[0]!.tieu_chi[0]!.lua_chon = [{ thu_tu: 1, mo_ta: "Đạt", diem: 100, sao_toi_thieu: null }];
    const { versionId } = await t.app.criteria.importVersion(a, { fileName: "thu.json", content: JSON.stringify(file) });
    const setId = (await t.app.criteria.getVersion(a, { versionId })).productGroups[0]!.subgroups[0]!.sets[0]!.id;
    const levels = async () => {
      const group = (await t.app.criteria.getCriteriaSet(a, { setId })).set.parts[0]!.sections[0]!.items[0]!;
      return group.kind === "group" ? group.criteria[0]!.levels : [];
    };
    const zero = (await levels()).find((l) => l.systemAdded)!;
    // Saving the values it already has changes nothing, so it stays system-added.
    await t.app.criteria.editDraft(a, { versionId, edit: { node: "scoreLevel", id: zero.id, changes: { description: zero.description, points: 0 } } });
    expect((await levels()).find((l) => l.id === zero.id)).toMatchObject({ systemAdded: true });
    await t.app.criteria.editDraft(a, { versionId, edit: { node: "scoreLevel", id: zero.id, changes } });
    expect((await levels()).find((l) => l.id === zero.id)).toMatchObject({ ...changes, systemAdded: false });
  });
});

describe("L19 AD-03/AD-04 kiểm tra sau mỗi lần sửa", () => {
  it("returns the check of the whole version after each edit", async () => {
    const { a, versionId, ids } = await draft();
    const broken = await t.app.criteria.editDraft(a, { versionId, edit: { node: "criterion", id: ids.criterion, changes: { maxPoints: 90 } } });
    expect(broken.issues.map((i) => [i.code, i.criterionCode])).toEqual([
      ["max_points_mismatch", "1.1.1"],
      ["group_points_mismatch", null],
    ]);
    const fixed = await t.app.criteria.editDraft(a, { versionId, edit: { node: "criterion", id: ids.criterion, changes: { maxPoints: 100 } } });
    expect(fixed.issues).toEqual([]);
    const thresholds = await t.app.criteria.editDraft(a, { versionId, edit: { node: "thresholds", changes: { 3: 20 } } });
    expect(thresholds.issues.map((i) => i.code)).toEqual(["thresholds_not_increasing"]);
  });
});

describe("L19 AD-03 từ chối", () => {
  it("refuses every edit of a published version", async () => {
    const { a, versionId, ids } = await draft();
    await t.app.criteria.publishVersion(a, { versionId });
    const refused = { code: "version_published" };
    await expect(t.app.criteria.editDraft(a, { versionId, edit: { node: "version", changes: { legalBasis: "Khác" } } })).rejects.toMatchObject(refused);
    await expect(t.app.criteria.editDraft(a, { versionId, edit: { node: "thresholds", changes: { 2: 1 } } })).rejects.toMatchObject(refused);
    await expect(t.app.criteria.editDraft(a, { versionId, edit: { node: "criterion", id: ids.criterion, changes: { name: "Khác" } } })).rejects.toMatchObject(
      refused,
    );
    expect((await t.app.criteria.getVersion(a, { versionId })).legalBasis).toBe("99/2027/QĐ-TTg");
  });

  it("only Quản trị edits a draft", async () => {
    const { versionId } = await draft();
    const edit = { node: "version", changes: { legalBasis: "Khác" } } as const;
    await expect(t.app.criteria.editDraft(await officer("so@tinh.gov.vn"), { versionId, edit })).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.criteria.editDraft(anonymous(), { versionId, edit })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuses an invalid value, naming the field", async () => {
    const { a, versionId, ids } = await draft();
    await expect(t.app.criteria.editDraft(a, { versionId, edit: { node: "part", id: ids.part, changes: { name: "  " } } })).rejects.toMatchObject({
      code: "invalid_value",
      message: "Tên: Không được để trống",
    });
    await expect(t.app.criteria.editDraft(a, { versionId, edit: { node: "criterion", id: ids.criterion, changes: { maxPoints: -1 } } })).rejects.toMatchObject({
      code: "invalid_value",
      message: "Điểm tối đa: Không được âm",
    });
    await expect(t.app.criteria.editDraft(a, { versionId, edit: { node: "version", changes: { issuedOn: "2027-02-30" } } })).rejects.toMatchObject({
      code: "invalid_value",
    });
    await expect(
      t.app.criteria.editDraft(a, { versionId, edit: { node: "scoreLevel", id: ids.scoreLevel, changes: { minimumStar: 2 as 3 } } }),
    ).rejects.toMatchObject({ code: "invalid_value" });
  });

  it("refuses a node of another version as not found", async () => {
    const one = await draft();
    const other = await draft();
    await expect(
      t.app.criteria.editDraft(one.a, { versionId: one.versionId, edit: { node: "criterion", id: other.ids.criterion, changes: { name: "Khác" } } }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("L19 AD-03 audit và outbox", () => {
  it("records the changed fields and emits criteria.draft.edited with the node", async () => {
    const { a, versionId, ids } = await draft();
    await t.app.criteria.editDraft(a, { versionId, edit: { node: "criterion", id: ids.criterion, changes: { name: "Tên mới", note: "", maxPoints: 100 } } });
    const [entry] = await t.app.audit.search(a, { action: ["criteria.draft.edited"], targetId: versionId });
    expect(entry).toMatchObject({
      actorUserId: a.userId,
      actorRole: "admin",
      targetType: "criteria_version",
      before: { name: "Tiêu chí thử" },
      after: { name: "Tên mới" },
      metadata: { node: "criterion", nodeId: ids.criterion },
    });
    expect(entry!.after).toEqual({ name: "Tên mới" });
    const { rows } = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'criteria.draft.edited' AND payload->>'versionId' = $1", [
      versionId,
    ]);
    expect(rows).toEqual([{ payload: { versionId, node: "criterion", nodeId: ids.criterion } }]);
  });

  it("writes nothing when the values do not change", async () => {
    const { a, versionId, ids } = await draft();
    await t.app.criteria.editDraft(a, { versionId, edit: { node: "part", id: ids.part, changes: { name: "PHẦN THỬ", points: 100 } } });
    expect(await t.app.audit.search(a, { action: ["criteria.draft.edited"], targetId: versionId })).toEqual([]);
    const { rows } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'criteria.draft.edited' AND payload->>'versionId' = $1", [versionId]);
    expect(rows).toEqual([]);
  });
});
