import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Core } from "@ocop/core";
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
type Actor = Parameters<Core["criteria"]["getVersion"]>[0];

/** A staff user with one Vai trò, created through the real activation flow. */
async function staff(email: string) {
  const a = await admin();
  const { userId } = await t.app.identity.createStaffUser(a, { email, fullName: "Cán Bộ" });
  await t.drainJobs();
  const token = /kich-hoat\?token=([\w-]+)/.exec(t.mailbox.to(email).at(-1)!.text)![1]!;
  await t.app.identity.activateAccount(anonymous(), { token, password: PASSWORD });
  await t.app.identity.grantRole(a, { userId, role: "province_officer", scopeId: null });
  return t.signInAs(email, PASSWORD);
}

const importQd26 = async () => (await t.app.criteria.importVersion(await admin(), { fileName: "qd26.json", content: qd26 })).versionId;

/** Every id-like value in a nested structure. */
function idsIn(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => idsIn(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if ((k === "id" || k.endsWith("Id")) && typeof v === "string") out.add(v);
      else idsIn(v, out);
    }
  }
  return out;
}

/** The structure with ids blanked, so two copies of the same content compare equal. */
function withoutIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIds);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === "id" || k.endsWith("Id") ? "<id>" : withoutIds(v)]));
  }
  return value;
}

/** The whole content of a version as Quản trị sees it: its tree and every Bộ tiêu chí. */
async function contentOf(actor: Actor, versionId: string) {
  const version = await t.app.criteria.getVersion(actor, { versionId });
  const setIds = version.productGroups.flatMap((g) => g.subgroups.flatMap((s) => s.sets.map((b) => b.id)));
  const sets = [];
  for (const setId of setIds) {
    const { set, productGroup, subgroup, thresholds } = await t.app.criteria.getCriteriaSet(actor, { setId });
    sets.push({ set, productGroup, subgroup, thresholds });
  }
  const { thresholds, productGroups, legalBasis, issuedOn, effectiveOn } = version;
  return { meta: { legalBasis, issuedOn, effectiveOn }, thresholds, productGroups, sets };
}

describe("L19 AD-04 sao chép phiên bản tiêu chí", () => {
  it("copies a published version deeply into a new draft with the same Văn bản căn cứ, recording copied_from", async () => {
    const a = await admin();
    const source = await importQd26();
    await t.app.criteria.publishVersion(a, { versionId: source });
    const before = await contentOf(a, source);

    const { versionId: copy } = await t.app.criteria.copyVersion(a, { versionId: source });

    const copied = await t.app.criteria.getVersion(a, { versionId: copy });
    expect(copied).toMatchObject({ status: "draft", copiedFrom: source, createdBy: a.userId, publishedAt: null, legalBasis: "26/2026/QĐ-TTg" });
    const after = await contentOf(a, copy);
    expect(withoutIds(after)).toEqual(withoutIds(before));
    expect(after.sets).toHaveLength(26);
    // No row of the copy points into the source: every id is new.
    const sourceIds = idsIn(before);
    expect([...idsIn(after)].filter((id) => sourceIds.has(id))).toEqual([]);
    // The source is untouched and still published.
    expect(await contentOf(a, source)).toEqual(before);
    expect((await t.app.criteria.getVersion(a, { versionId: source })).status).toBe("published");
  });

  it("copies a draft, and the copy passes the same check as its source", async () => {
    const a = await admin();
    const source = await importQd26();
    const { versionId: copy } = await t.app.criteria.copyVersion(a, { versionId: source });
    expect(await t.app.criteria.validateVersion(a, { versionId: copy })).toEqual({ issues: [] });
    await t.app.criteria.publishVersion(a, { versionId: copy });
    expect((await t.app.criteria.getVersion(a, { versionId: source })).status).toBe("draft");
  });

  it("leaves the copy independent: deleting the source draft keeps the copy whole", async () => {
    const a = await admin();
    const source = await importQd26();
    const { versionId: copy } = await t.app.criteria.copyVersion(a, { versionId: source });
    const before = await contentOf(a, copy);
    await t.app.criteria.deleteVersion(a, { versionId: source });
    expect(await contentOf(a, copy)).toEqual(before);
    expect((await t.app.criteria.getVersion(a, { versionId: copy })).copiedFrom).toBe(source);
  });

  it("records the copy in audit and outbox", async () => {
    const a = await admin();
    const source = await importQd26();
    const { versionId: copy } = await t.app.criteria.copyVersion(a, { versionId: source });
    const [entry] = await t.app.audit.search(a, { action: ["criteria.version.copied"], targetId: copy });
    expect(entry).toMatchObject({
      actorRole: "admin",
      actorUserId: a.userId,
      targetType: "criteria_version",
      after: { status: "draft", legalBasis: "26/2026/QĐ-TTg", copiedFrom: source },
      metadata: { sets: 26 },
    });
    const { rows } = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'criteria.version.copied' AND payload->>'versionId' = $1", [copy]);
    expect(rows).toEqual([{ payload: { versionId: copy, copiedFrom: source } }]);
  });

  it("reports an unknown version as not found", async () => {
    await expect(t.app.criteria.copyVersion(await admin(), { versionId: "0190a000-0000-7000-8000-000000000000" })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("L19 AD-04 xóa bản nháp", () => {
  it("deletes a draft with its whole tree", async () => {
    const a = await admin();
    const versionId = await importQd26();
    const setId = (await t.app.criteria.getVersion(a, { versionId })).productGroups[0]!.subgroups[0]!.sets[0]!.id;

    await t.app.criteria.deleteVersion(a, { versionId });

    await expect(t.app.criteria.getVersion(a, { versionId })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.criteria.getCriteriaSet(a, { setId })).rejects.toMatchObject({ code: "not_found" });
    expect((await t.app.criteria.listVersions(a)).map((v) => v.id)).not.toContain(versionId);
    const { rows } = await db.admin.query<{ n: number }>("SELECT count(*)::int AS n FROM criteria.score_level WHERE version_id = $1", [versionId]);
    expect(rows[0]!.n).toBe(0);
  });

  it("refuses to delete a published version and leaves it whole", async () => {
    const a = await admin();
    const versionId = await importQd26();
    await t.app.criteria.publishVersion(a, { versionId });
    const before = await contentOf(a, versionId);
    await expect(t.app.criteria.deleteVersion(a, { versionId })).rejects.toMatchObject({ code: "version_published" });
    expect(await contentOf(a, versionId)).toEqual(before);
  });

  it("records the deletion in audit and outbox", async () => {
    const a = await admin();
    const versionId = await importQd26();
    await t.app.criteria.deleteVersion(a, { versionId });
    const [entry] = await t.app.audit.search(a, { action: ["criteria.version.deleted"], targetId: versionId });
    expect(entry).toMatchObject({
      actorRole: "admin",
      actorUserId: a.userId,
      targetType: "criteria_version",
      before: { status: "draft", legalBasis: "26/2026/QĐ-TTg", issuedOn: "2026-05-22" },
      after: null,
      metadata: { sets: 26 },
    });
    const { rows } = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'criteria.version.deleted' AND payload->>'versionId' = $1", [versionId]);
    expect(rows).toEqual([{ payload: { versionId } }]);
  });

  it("reports an unknown version as not found", async () => {
    await expect(t.app.criteria.deleteVersion(await admin(), { versionId: "0190a000-0000-7000-8000-000000000000" })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("L19 AD-04 chỉ Quản trị sao chép và xóa", () => {
  it("refuses other Vai trò and anonymous callers", async () => {
    const a = await admin();
    const versionId = await importQd26();
    await t.app.criteria.publishVersion(a, { versionId });
    const draft = await importQd26();
    const officer = await staff("so@tinh.gov.vn");
    for (const caller of [officer, anonymous()]) {
      await expect(t.app.criteria.copyVersion(caller, { versionId })).rejects.toMatchObject({ code: "forbidden" });
      await expect(t.app.criteria.deleteVersion(caller, { versionId: draft })).rejects.toMatchObject({ code: "forbidden" });
    }
    expect((await t.app.criteria.getVersion(a, { versionId: draft })).status).toBe("draft");
  });

  it("needs no Xác thực lại: an old session still copies and deletes drafts", async () => {
    const a = await admin();
    const versionId = await importQd26();
    t.clock.advance(minutes(30));
    const { versionId: copy } = await t.app.criteria.copyVersion(a, { versionId });
    await t.app.criteria.deleteVersion(a, { versionId: copy });
  });
});
