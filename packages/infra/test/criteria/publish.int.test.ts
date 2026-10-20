import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonymous, createTestApp, createTestDatabase, minutes, systemActor, type TestApp, type TestDatabase } from "../support";

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

/** A staff user with one Vai trò, created through the real activation flow. */
async function staff(email: string, role: "province_officer") {
  const a = await admin();
  const { userId } = await t.app.identity.createStaffUser(a, { email, fullName: "Cán Bộ" });
  await t.drainJobs();
  const token = /kich-hoat\?token=([\w-]+)/.exec(t.mailbox.to(email).at(-1)!.text)![1]!;
  await t.app.identity.activateAccount(anonymous(), { token, password: PASSWORD });
  await t.app.identity.grantRole(a, { userId, role, scopeId: null });
  return t.signInAs(email, PASSWORD);
}

/** One Bộ tiêu chí of 100 điểm with a single Tiêu chí; `over` patches the Tiêu chí. */
function tinyFile(over: Record<string, unknown> = {}) {
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
        tong_diem: 100,
        tieu_chi: [
          {
            phan: "A",
            phan_ten: "PHẦN THỬ",
            phan_diem: 100,
            muc: "1",
            muc_ten: "MỤC THỬ",
            muc_diem: 100,
            ma: "1.1",
            ten: "Tiêu chí thử",
            diem_toi_da: 100,
            yeu_cau: "",
            ghi_chu: "",
            lua_chon: [{ thu_tu: 1, mo_ta: "Đạt", diem: 100, sao_toi_thieu: null }],
            ...over,
          },
        ],
      },
    ],
  });
}

const importDraft = async (content = tinyFile()) => (await t.app.criteria.importVersion(await admin(), { fileName: "thu.json", content })).versionId;

describe("L19 AD-04 kiểm tra bản nháp", () => {
  it("finds no problem in QĐ 26 as imported", async () => {
    const versionId = (await t.app.criteria.importVersion(await admin(), { fileName: "qd26.json", content: qd26 })).versionId;
    expect(await t.app.criteria.validateVersion(await admin(), { versionId })).toEqual({ issues: [] });
  });

  it("lists every problem with its Bộ tiêu chí and mã tiêu chí", async () => {
    const versionId = await importDraft(tinyFile({ diem_toi_da: 90, muc_diem: 90 }));
    const { issues } = await t.app.criteria.validateVersion(await admin(), { versionId });
    expect(issues.map((i) => [i.code, i.setCode, i.criterionCode])).toEqual([
      ["max_points_mismatch", "1", "1.1"],
      ["part_points_mismatch", "1", null],
    ]);
  });
});

describe("L19 AD-04 phát hành", () => {
  it("requires Xác thực lại within 5 minutes", async () => {
    const a = await admin();
    const versionId = await importDraft();
    t.clock.advance(minutes(5) + 1000);
    await expect(t.app.criteria.publishVersion(a, { versionId })).rejects.toMatchObject({ code: "reauth_required" });
    expect((await t.app.criteria.getVersion(a, { versionId })).status).toBe("draft");

    await expect(t.app.identity.reauthenticate(a, { password: ADMIN.password })).resolves.toEqual({ ok: true });
    const { publishedAt } = await t.app.criteria.publishVersion(a, { versionId });
    expect(await t.app.criteria.getVersion(a, { versionId })).toMatchObject({ status: "published", publishedAt, publishedBy: a.userId });
  });

  it("refuses a draft the check finds problems in, listing them, and leaves it a draft", async () => {
    const a = await admin();
    const versionId = await importDraft(tinyFile({ diem_toi_da: 90, muc_diem: 90 }));
    await expect(t.app.criteria.publishVersion(a, { versionId })).rejects.toMatchObject({
      code: "validation_failed",
      issues: [expect.objectContaining({ code: "max_points_mismatch" }), expect.objectContaining({ code: "part_points_mismatch" })],
    });
    expect((await t.app.criteria.getVersion(a, { versionId })).status).toBe("draft");
  });

  it("records who published, when and how they re-authenticated, and emits criteria.version.published", async () => {
    const a = await admin();
    const versionId = await importDraft();
    await t.app.criteria.publishVersion(a, { versionId });
    const [entry] = await t.app.audit.search(a, { action: ["criteria.version.published"], targetId: versionId });
    expect(entry).toMatchObject({
      actorRole: "admin",
      actorUserId: a.userId,
      targetType: "criteria_version",
      before: { status: "draft" },
      after: { status: "published", legalBasis: "99/2027/QĐ-TTg" },
      metadata: { reauth: { method: "password" } },
    });
    const { rows } = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'criteria.version.published' AND payload->>'versionId' = $1", [
      versionId,
    ]);
    expect(rows).toEqual([{ payload: { versionId } }]);
  });

  it("publishes once: a published version cannot be published again", async () => {
    const a = await admin();
    const versionId = await importDraft();
    await t.app.criteria.publishVersion(a, { versionId });
    await expect(t.app.criteria.publishVersion(a, { versionId })).rejects.toMatchObject({ code: "version_published" });
  });

  it("only Quản trị validates and publishes", async () => {
    const versionId = await importDraft();
    const officer = await staff("so@tinh.gov.vn", "province_officer");
    await expect(t.app.criteria.validateVersion(officer, { versionId })).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.criteria.publishVersion(officer, { versionId })).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.criteria.publishVersion(anonymous(), { versionId })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("L19 xem phiên bản đã phát hành", () => {
  it("shows a published version, its tree and its Bộ tiêu chí to a Vai trò other than Quản trị, but not drafts", async () => {
    const a = await admin();
    const published = await importDraft();
    await t.app.criteria.publishVersion(a, { versionId: published });
    const draft = await importDraft();
    const member = await staff("so2@tinh.gov.vn", "province_officer");

    const listed = (await t.app.criteria.listVersions(member)).map((v) => v.id);
    expect(listed).toContain(published);
    expect(listed).not.toContain(draft);
    const tree = await t.app.criteria.getVersion(member, { versionId: published });
    const setId = tree.productGroups[0]!.subgroups[0]!.sets[0]!.id;
    expect(await t.app.criteria.getCriteriaSet(member, { setId })).toMatchObject({
      version: { id: published, status: "published" },
      thresholds: tree.thresholds,
      productGroup: "Nhóm thử",
      subgroup: "Phân nhóm thử",
      set: { code: "1" },
    });
    await expect(t.app.criteria.getVersion(member, { versionId: draft })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("L19 bất biến ba lớp: trigger DB", () => {
  /** QĐ 26 published, so every table of the tree (Nhóm tiêu chí, Điều kiện loại included) has rows. */
  let published: string;
  let draft: string;
  beforeAll(async () => {
    const a = await admin();
    published = (await t.app.criteria.importVersion(a, { fileName: "qd26.json", content: qd26 })).versionId;
    await t.app.criteria.publishVersion(a, { versionId: published });
    draft = await importDraft();
  });

  /** Every table of the tree with a harmless assignment for an UPDATE. */
  const TABLES: [table: string, key: string, assignment: string][] = [
    ["version", "id", "legal_basis = legal_basis"],
    ["rank_threshold", "version_id", "min_score = min_score"],
    ["product_group", "version_id", "name = name || ' sửa'"],
    ["product_subgroup", "version_id", "position = position"],
    ["criteria_set", "version_id", "total_points = 1"],
    ["exclusion_condition", "version_id", "description = 'sửa'"],
    ["part", "version_id", "points = points"],
    ["section", "version_id", "points = points"],
    ["criterion_group", "version_id", "points = points"],
    ["criterion", "version_id", "max_points = 0"],
    ["score_level", "version_id", "points = 0"],
  ];

  it.each(TABLES)("refuses UPDATE and DELETE on criteria.%s of a published version, as the app user", async (table, key, assignment) => {
    const { rows } = await db.app.query<{ n: number }>(`SELECT count(*)::int AS n FROM criteria.${table} WHERE ${key} = $1`, [published]);
    expect(rows[0]!.n).toBeGreaterThan(0);
    await expect(db.app.query(`UPDATE criteria.${table} SET ${assignment} WHERE ${key} = $1`, [published])).rejects.toThrow(/published/);
    await expect(db.app.query(`DELETE FROM criteria.${table} WHERE ${key} = $1`, [published])).rejects.toThrow(/published/);
  });

  it("refuses new rows under a published version", async () => {
    const [set] = (await db.app.query<{ id: string }>("SELECT id FROM criteria.criteria_set WHERE version_id = $1 LIMIT 1", [published])).rows;
    const [c] = (await db.app.query<{ id: string }>("SELECT id FROM criteria.criterion WHERE version_id = $1 LIMIT 1", [published])).rows;
    await expect(
      db.app.query("INSERT INTO criteria.exclusion_condition (id, version_id, set_id, description, position) VALUES (gen_random_uuid(), $1, $2, 'mới', 99)", [
        published,
        set!.id,
      ]),
    ).rejects.toThrow(/published/);
    await expect(
      db.app.query(
        "INSERT INTO criteria.score_level (id, version_id, set_id, criterion_id, description, points, position) VALUES (gen_random_uuid(), $1, $2, $3, 'mới', 0, 99)",
        [published, set!.id, c!.id],
      ),
    ).rejects.toThrow(/published/);
    await expect(db.app.query("INSERT INTO criteria.product_group (id, version_id, name, position) VALUES (gen_random_uuid(), $1, 'mới', 99)", [published])).rejects.toThrow(
      /published/,
    );
  });

  it("refuses the change even from the table owner, and the app user cannot switch the triggers off", async () => {
    await expect(db.admin.query("UPDATE criteria.criterion SET max_points = 0 WHERE version_id = $1", [published])).rejects.toThrow(/published/);
    await expect(db.app.query("ALTER TABLE criteria.criterion DISABLE TRIGGER ALL")).rejects.toThrow(/must be owner/);
    await expect(db.app.query("SET session_replication_role = replica")).rejects.toThrow(/permission denied/);
    await expect(db.app.query("UPDATE criteria.version SET status = 'draft', published_at = NULL, published_by = NULL WHERE id = $1", [published])).rejects.toThrow(
      /published/,
    );
  });

  it("leaves drafts free to change and delete", async () => {
    await expect(db.app.query("UPDATE criteria.criterion SET name = name || ' sửa' WHERE version_id = $1", [draft])).resolves.toMatchObject({ rowCount: 1 });
    await expect(db.app.query("DELETE FROM criteria.version WHERE id = $1", [draft])).resolves.toMatchObject({ rowCount: 1 });
    const { rows } = await db.app.query<{ n: number }>("SELECT count(*)::int AS n FROM criteria.score_level WHERE version_id = $1", [draft]);
    expect(rows[0]!.n).toBe(0);
  });
});

describe("L19 mã sai định dạng (từ URL hoặc biểu mẫu)", () => {
  const BAD = "abc";

  it("reports a malformed version, Bộ tiêu chí or node id as not found, not a server error", async () => {
    const a = await admin();
    const versionId = await importDraft();
    const calls: [string, () => Promise<unknown>][] = [
      ["getVersion", () => t.app.criteria.getVersion(a, { versionId: BAD })],
      ["getCriteriaSet", () => t.app.criteria.getCriteriaSet(a, { setId: BAD })],
      ["previewSet", () => t.app.criteria.previewSet(a, { setId: BAD, levelIds: [] })],
      ["validateVersion", () => t.app.criteria.validateVersion(a, { versionId: BAD })],
      ["publishVersion", () => t.app.criteria.publishVersion(a, { versionId: BAD })],
      ["copyVersion", () => t.app.criteria.copyVersion(a, { versionId: BAD })],
      ["deleteVersion", () => t.app.criteria.deleteVersion(a, { versionId: BAD })],
      ["editDraft version", () => t.app.criteria.editDraft(a, { versionId: BAD, edit: { node: "version", changes: { legalBasis: "Mới" } } })],
      ["editDraft node", () => t.app.criteria.editDraft(a, { versionId, edit: { node: "criterion", id: BAD, changes: { name: "Mới" } } })],
      ["removeNode", () => t.app.criteria.removeNode(a, { versionId, node: "criterion", id: BAD })],
      ["moveNode", () => t.app.criteria.moveNode(a, { versionId, node: "criterion", id: BAD, direction: "up" })],
      [
        "addNode",
        () => t.app.criteria.addNode(a, { versionId, addition: { node: "subgroup", parent: { node: "productGroup", id: BAD }, values: { name: "Mới" } } }),
      ],
    ];
    for (const [name, call] of calls) {
      await expect(call(), name).rejects.toMatchObject({ code: "not_found" });
    }
  });
});

