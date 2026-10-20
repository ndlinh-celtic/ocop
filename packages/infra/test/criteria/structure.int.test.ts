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

/** The items of the fixture's only Mục, as `kind:code`. */
async function sectionItems(a: Awaited<ReturnType<typeof admin>>, setId: string) {
  const { set } = await t.app.criteria.getCriteriaSet(a, { setId });
  return set.parts[0]!.sections[0]!.items;
}

describe("L19 AD-03 thêm nút vào bản nháp", () => {
  it("adds a Tiêu chí directly in a Mục after its Nhóm tiêu chí, with the Không đáp ứng, 0 điểm level", async () => {
    const { a, versionId, ids } = await draft();
    const { nodeId } = await t.app.criteria.addNode(a, {
      versionId,
      addition: { node: "criterion", parent: { node: "section", id: ids.section }, values: { code: "1.2", name: "Tiêu chí mới", maxPoints: 10 } },
    });
    const items = await sectionItems(a, ids.set);
    expect(items.map((i) => [i.kind, i.code])).toEqual([
      ["group", "1.1"],
      ["criterion", "1.2"],
    ]);
    expect(items[1]).toMatchObject({
      id: nodeId,
      name: "Tiêu chí mới",
      maxPoints: 10,
      requirement: "",
      note: "",
      levels: [{ description: "Không đáp ứng", points: 0, minimumStar: null, branch: null, systemAdded: true }],
    });
  });

  it("adds every kind of node, each at the end of its siblings", async () => {
    const { a, versionId, ids } = await draft();
    const add = async (addition: Parameters<typeof t.app.criteria.addNode>[1]["addition"]) => (await t.app.criteria.addNode(a, { versionId, addition })).nodeId;
    const productGroup = await add({ node: "productGroup", values: { name: "Nhóm mới" } });
    const subgroup = await add({ node: "subgroup", parent: { node: "productGroup", id: productGroup }, values: { name: "Phân nhóm mới" } });
    const setId = await add({ node: "set", parent: { node: "subgroup", id: subgroup }, values: { code: "2", name: "Bộ mới", totalPoints: 100 } });
    await add({ node: "exclusion", parent: { node: "set", id: setId }, values: { description: "Không có giấy phép" } });
    const part = await add({ node: "part", parent: { node: "set", id: setId }, values: { code: "A", name: "PHẦN A", points: 100 } });
    const section = await add({ node: "section", parent: { node: "part", id: part }, values: { code: "1", name: "MỤC 1", points: 100 } });
    const group = await add({ node: "criterionGroup", parent: { node: "section", id: section }, values: { code: "1.1", name: "Nhóm 1.1", points: 100 } });
    const criterion = await add({
      node: "criterion",
      parent: { node: "criterionGroup", id: group },
      values: { code: "1.1.1", name: "Tiêu chí", maxPoints: 100, requirement: "Có" },
    });
    await add({ node: "scoreLevel", parent: { node: "criterion", id: criterion }, values: { description: "Đạt", points: 100, minimumStar: 4, branch: "" } });
    // A second Điều kiện loại in the fixture's own Bộ tiêu chí goes after the first.
    await add({ node: "exclusion", parent: { node: "set", id: ids.set }, values: { description: "Điều kiện thứ hai" } });

    const tree = await t.app.criteria.getVersion(a, { versionId });
    expect(tree.productGroups.map((g) => g.name)).toEqual(["Nhóm thử", "Nhóm mới"]);
    expect(tree.productGroups[1]!.subgroups.map((s) => [s.name, s.sets.map((b) => [b.code, b.name])])).toEqual([["Phân nhóm mới", [["2", "Bộ mới"]]]]);
    const { set } = await t.app.criteria.getCriteriaSet(a, { setId });
    expect(set.exclusionConditions.map((e) => e.description)).toEqual(["Không có giấy phép"]);
    expect(set.parts).toMatchObject([
      {
        code: "A",
        sections: [
          {
            code: "1",
            items: [
              {
                kind: "group",
                code: "1.1",
                criteria: [
                  {
                    code: "1.1.1",
                    requirement: "Có",
                    levels: [
                      { description: "Không đáp ứng", points: 0, systemAdded: true },
                      { description: "Đạt", points: 100, minimumStar: 4, branch: null, systemAdded: false },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
    const own = (await t.app.criteria.getCriteriaSet(a, { setId: ids.set })).set.exclusionConditions;
    expect([own.length, own.at(-1)!.description]).toEqual([2, "Điều kiện thứ hai"]);
  });

  it("refuses a parent of the wrong kind or of another version, and an invalid value", async () => {
    const one = await draft();
    const other = await draft();
    const add = (addition: Parameters<typeof t.app.criteria.addNode>[1]["addition"]) => t.app.criteria.addNode(one.a, { versionId: one.versionId, addition });
    await expect(add({ node: "part", parent: { node: "set", id: other.ids.set }, values: { code: "B", name: "PHẦN B", points: 1 } })).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(add({ node: "section", parent: { node: "set" as "part", id: one.ids.set }, values: { code: "2", name: "MỤC 2", points: 1 } })).rejects.toMatchObject({
      code: "invalid_value",
    });
    await expect(add({ node: "part", parent: { node: "set", id: one.ids.set }, values: { code: "B", name: " ", points: 1 } })).rejects.toMatchObject({
      code: "invalid_value",
      message: "Tên: Không được để trống",
    });
  });
});

describe("L19 AD-03 xóa nút", () => {
  const count = async (table: string, versionId: string) =>
    (await db.admin.query<{ n: number }>(`SELECT count(*)::int AS n FROM criteria.${table} WHERE version_id = $1`, [versionId])).rows[0]!.n;

  it("removes a node with all of its children", async () => {
    const { a, versionId, ids } = await draft();
    await t.app.criteria.removeNode(a, { versionId, node: "criterionGroup", id: ids.criterionGroup });
    expect(await sectionItems(a, ids.set)).toEqual([]);
    expect([await count("criterion", versionId), await count("score_level", versionId)]).toEqual([0, 0]);

    await t.app.criteria.removeNode(a, { versionId, node: "productGroup", id: ids.productGroup });
    expect((await t.app.criteria.getVersion(a, { versionId })).productGroups).toEqual([]);
    expect([await count("criteria_set", versionId), await count("part", versionId), await count("exclusion_condition", versionId)]).toEqual([0, 0, 0]);
  });

  it("removes a single Mức điểm or Điều kiện loại", async () => {
    const { a, versionId, ids } = await draft();
    await t.app.criteria.removeNode(a, { versionId, node: "scoreLevel", id: ids.scoreLevel });
    await t.app.criteria.removeNode(a, { versionId, node: "exclusion", id: ids.exclusion });
    const { set } = await t.app.criteria.getCriteriaSet(a, { setId: ids.set });
    const group = set.parts[0]!.sections[0]!.items[0]!;
    expect(group.kind === "group" && group.criteria[0]!.levels.map((l) => l.description)).toEqual(["Chưa đạt"]);
    expect(set.exclusionConditions).toEqual([]);
  });

  it("refuses a node of another version as not found", async () => {
    const one = await draft();
    const other = await draft();
    await expect(t.app.criteria.removeNode(one.a, { versionId: one.versionId, node: "criterion", id: other.ids.criterion })).rejects.toMatchObject({ code: "not_found" });
    expect(await count("criterion", other.versionId)).toBe(1);
  });
});

describe("L19 AD-03 sắp xếp lại nút", () => {
  it("moves a node up and down among its siblings; Nhóm tiêu chí and Tiêu chí in a Mục share one order", async () => {
    const { a, versionId, ids } = await draft();
    const add = (code: string) =>
      t.app.criteria.addNode(a, { versionId, addition: { node: "criterion", parent: { node: "section", id: ids.section }, values: { code, name: `Tiêu chí ${code}`, maxPoints: 0 } } });
    const { nodeId: c2 } = await add("1.2");
    await add("1.3");
    const codes = async () => (await sectionItems(a, ids.set)).map((i) => i.code);
    expect(await codes()).toEqual(["1.1", "1.2", "1.3"]);

    await t.app.criteria.moveNode(a, { versionId, node: "criterion", id: c2, direction: "up" });
    expect(await codes()).toEqual(["1.2", "1.1", "1.3"]);
    await t.app.criteria.moveNode(a, { versionId, node: "criterionGroup", id: ids.criterionGroup, direction: "down" });
    expect(await codes()).toEqual(["1.2", "1.3", "1.1"]);
    await t.app.criteria.moveNode(a, { versionId, node: "criterionGroup", id: ids.criterionGroup, direction: "down" });
    expect(await codes()).toEqual(["1.2", "1.3", "1.1"]);

    await t.app.criteria.moveNode(a, { versionId, node: "scoreLevel", id: ids.scoreLevel, direction: "up" });
    const group = (await sectionItems(a, ids.set)).find((i) => i.kind === "group")!;
    expect(group.kind === "group" && group.criteria[0]!.levels.map((l) => l.description)).toEqual(["Đạt", "Chưa đạt"]);
  });

  it("writes nothing when the node is already first or last", async () => {
    const { a, versionId, ids } = await draft();
    await t.app.criteria.moveNode(a, { versionId, node: "part", id: ids.part, direction: "up" });
    await t.app.criteria.moveNode(a, { versionId, node: "part", id: ids.part, direction: "down" });
    expect(await t.app.audit.search(a, { action: ["criteria.draft.node_moved"], targetId: versionId })).toEqual([]);
  });
});

describe("L19 AD-03/AD-04 kiểm tra sau mỗi thao tác", () => {
  it("returns the check of the whole version after each add, move and remove", async () => {
    const { a, versionId, ids } = await draft();
    const added = await t.app.criteria.addNode(a, {
      versionId,
      addition: { node: "criterion", parent: { node: "criterionGroup", id: ids.criterionGroup }, values: { code: "1.1.2", name: "Thêm", maxPoints: 10 } },
    });
    expect(added.issues.map((i) => i.code)).toEqual(["max_points_mismatch", "group_points_mismatch"]);
    const moved = await t.app.criteria.moveNode(a, { versionId, node: "criterion", id: added.nodeId, direction: "up" });
    expect(moved.issues.map((i) => i.code)).toEqual(["max_points_mismatch", "group_points_mismatch"]);
    const removed = await t.app.criteria.removeNode(a, { versionId, node: "criterion", id: added.nodeId });
    expect(removed.issues).toEqual([]);
  });

  it("returns the same check as validating the version afresh, for every kind of change", async () => {
    const { a, versionId, ids } = await draft();
    const fresh = async () => (await t.app.criteria.validateVersion(a, { versionId })).issues;
    const steps = [
      () => t.app.criteria.addNode(a, { versionId, addition: { node: "part", parent: { node: "set", id: ids.set }, values: { code: "B", name: "PHẦN B", points: 5 } } }),
      () => t.app.criteria.addNode(a, { versionId, addition: { node: "scoreLevel", parent: { node: "criterion", id: ids.criterion }, values: { description: "Thêm", points: 120 } } }),
      () => t.app.criteria.addNode(a, { versionId, addition: { node: "productGroup", values: { name: "Nhóm thử" } } }),
      () => t.app.criteria.moveNode(a, { versionId, node: "part", id: ids.part, direction: "down" }),
      () => t.app.criteria.removeNode(a, { versionId, node: "section", id: ids.section }),
      () => t.app.criteria.removeNode(a, { versionId, node: "subgroup", id: ids.subgroup }),
    ];
    for (const step of steps) {
      const { issues } = await step();
      expect(issues).toEqual(await fresh());
    }
  });

  it("reports a Tiêu chí left without a 0-point Mức điểm, and publishing is refused", async () => {
    const { a, versionId, ids } = await draft();
    const { nodeId } = await t.app.criteria.addNode(a, {
      versionId,
      addition: { node: "criterion", parent: { node: "section", id: ids.section }, values: { code: "1.2", name: "Thêm", maxPoints: 0 } },
    });
    const added = (await sectionItems(a, ids.set)).find((i) => i.id === nodeId)!;
    const zero = added.kind === "criterion" ? added.levels.find((l) => l.systemAdded)! : null;
    const { issues } = await t.app.criteria.removeNode(a, { versionId, node: "scoreLevel", id: zero!.id });
    expect(issues).toEqual([expect.objectContaining({ code: "missing_zero_level", setId: ids.set, criterionCode: "1.2" })]);
    await expect(t.app.criteria.publishVersion(a, { versionId })).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("L19 AD-03 từ chối thao tác cấu trúc", () => {
  it("refuses to add, remove or move on a published version", async () => {
    const { a, versionId, ids } = await draft();
    await t.app.criteria.publishVersion(a, { versionId });
    const refused = { code: "version_published" };
    await expect(t.app.criteria.addNode(a, { versionId, addition: { node: "productGroup", values: { name: "Khác" } } })).rejects.toMatchObject(refused);
    await expect(t.app.criteria.removeNode(a, { versionId, node: "criterion", id: ids.criterion })).rejects.toMatchObject(refused);
    await expect(t.app.criteria.moveNode(a, { versionId, node: "scoreLevel", id: ids.scoreLevel, direction: "up" })).rejects.toMatchObject(refused);
    expect((await t.app.criteria.getVersion(a, { versionId })).productGroups).toHaveLength(1);
  });

  it("only Quản trị changes the structure", async () => {
    const { versionId, ids } = await draft();
    const so = await officer("so-cau-truc@tinh.gov.vn");
    for (const actor of [so, anonymous()]) {
      await expect(t.app.criteria.addNode(actor, { versionId, addition: { node: "productGroup", values: { name: "Khác" } } })).rejects.toMatchObject({ code: "forbidden" });
      await expect(t.app.criteria.removeNode(actor, { versionId, node: "criterion", id: ids.criterion })).rejects.toMatchObject({ code: "forbidden" });
      await expect(t.app.criteria.moveNode(actor, { versionId, node: "part", id: ids.part, direction: "down" })).rejects.toMatchObject({ code: "forbidden" });
    }
  });
});

describe("L19 AD-03 audit và outbox của thao tác cấu trúc", () => {
  const outbox = async (type: string, versionId: string) =>
    (await db.admin.query("SELECT payload FROM platform.outbox WHERE type = $1 AND payload->>'versionId' = $2", [type, versionId])).rows;

  it("records an added node and emits criteria.draft.node_added", async () => {
    const { a, versionId, ids } = await draft();
    const { nodeId } = await t.app.criteria.addNode(a, {
      versionId,
      addition: { node: "criterion", parent: { node: "section", id: ids.section }, values: { code: "1.2", name: "Mới", maxPoints: 0 } },
    });
    const [entry] = await t.app.audit.search(a, { action: ["criteria.draft.node_added"], targetId: versionId });
    expect(entry).toMatchObject({
      actorRole: "admin",
      targetType: "criteria_version",
      before: null,
      after: { id: nodeId, code: "1.2", name: "Mới", sectionId: ids.section, groupId: null, position: 1 },
      metadata: { node: "criterion", nodeId, added: { scoreLevel: 1 } },
    });
    expect(await outbox("criteria.draft.node_added", versionId)).toEqual([{ payload: { versionId, node: "criterion", nodeId } }]);
  });

  it("records a removed node with what went with it and emits criteria.draft.node_removed", async () => {
    const { a, versionId, ids } = await draft();
    await t.app.criteria.removeNode(a, { versionId, node: "part", id: ids.part });
    const [entry] = await t.app.audit.search(a, { action: ["criteria.draft.node_removed"], targetId: versionId });
    expect(entry).toMatchObject({
      before: { id: ids.part, code: "A", name: "PHẦN THỬ" },
      after: null,
      metadata: { node: "part", nodeId: ids.part, removed: { section: 1, criterionGroup: 1, criterion: 1, scoreLevel: 2 } },
    });
    expect(await outbox("criteria.draft.node_removed", versionId)).toEqual([{ payload: { versionId, node: "part", nodeId: ids.part } }]);
  });

  it("records a move and emits criteria.draft.node_moved", async () => {
    const { a, versionId, ids } = await draft();
    await t.app.criteria.moveNode(a, { versionId, node: "scoreLevel", id: ids.scoreLevel, direction: "up" });
    const [entry] = await t.app.audit.search(a, { action: ["criteria.draft.node_moved"], targetId: versionId });
    expect(entry).toMatchObject({ before: { position: 1 }, after: { position: 0 }, metadata: { node: "scoreLevel", nodeId: ids.scoreLevel, direction: "up" } });
    expect(await outbox("criteria.draft.node_moved", versionId)).toEqual([{ payload: { versionId, node: "scoreLevel", nodeId: ids.scoreLevel } }]);
  });
});
