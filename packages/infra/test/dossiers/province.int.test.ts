import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, entityIdOf, fixtures } from "./fixtures";

/*
 * L04, L06 (#44, spec #30 stories 57 to 59, 78, 79, 83): the Cán bộ Sở sees every hồ sơ that has reached
 * the province and its Chủ thể, only counts of the others, and trả về a hồ sơ Đã chuyển tỉnh to Yêu cầu
 * bổ sung; the Cán bộ xã may ask the Sở to do so.
 */

let db: TestDatabase;
let t: TestApp;
let wardId: string;
let otherWardId: string;
let f: ReturnType<typeof fixtures>;
let setId: string;
let ward: UserActor;
let province: UserActor;
const START = new Date("2026-10-19T02:00:00Z");

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n00002,Xã Bình Lợi\n");
  const wards = await t.app.org.listWards();
  wardId = wards.find((w) => w.name === "Xã An Phú")!.id;
  otherWardId = wards.find((w) => w.name === "Xã Bình Lợi")!.id;
  f = fixtures(t, () => wardId);
  t.clock.set(START);
  const version = await f.publishedVersion("26/2026/QĐ-TTg");
  setId = version.sets["Rau củ quả"];
  await f.openRound(version.versionId);
  ward = await f.staff("ward_officer", wardId);
  province = await f.staff("province_officer");
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("L06 Cán bộ Sở sees the hồ sơ that reached the province (stories 78, 79)", () => {
  it("reads a hồ sơ Đã chuyển tỉnh, its timeline and its Chủ thể; a hồ sơ not yet forwarded and its Chủ thể are not found", async () => {
    const up = await f.forwarded(ward, setId);
    const down = await f.submitted(setId);

    expect(await t.app.dossiers.get(province, { dossierId: up.dossierId })).toMatchObject({ id: up.dossierId, state: "forwarded_to_province" });
    expect((await t.app.dossiers.timeline(province, { dossierId: up.dossierId })).at(-1)).toMatchObject({ action: "dossier.forward" });
    expect(await t.app.entities.getEntity(province, { entityId: entityIdOf(up.a) })).toMatchObject({ id: entityIdOf(up.a) });
    const listed = (await t.app.dossiers.list(province)).map((d) => d.id);
    expect(listed).toContain(up.dossierId);
    expect(listed).not.toContain(down.dossierId);

    await expect(t.app.dossiers.get(province, { dossierId: down.dossierId })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.dossiers.timeline(province, { dossierId: down.dossierId })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.entities.getEntity(province, { entityId: entityIdOf(down.a) })).rejects.toMatchObject({ code: "not_found" });
    expect((await t.app.entities.listEntities(province)).map((e) => e.id)).not.toContain(entityIdOf(down.a));
  });

  it("downloads the Phiếu đăng ký, the Báo cáo tự đánh giá and the signed Báo cáo đánh giá cấp xã of a hồ sơ that reached the province", async () => {
    const up = await f.forwarded(ward, setId);
    const down = await f.submitted(setId);

    for (const document of ["registration_form", "self_assessment_report"] as const) {
      const { url } = await t.app.dossiers.downloadSubmissionDocument(province, { dossierId: up.dossierId, submissionNumber: 1, document });
      expect((await fetch(url)).ok).toBe(true);
    }
    const { url, fileName } = await t.app.dossiers.downloadSignedWardReport(province, { dossierId: up.dossierId });
    expect(fileName).toBe("BC xã đã ký.pdf");
    expect((await fetch(url)).ok).toBe(true);
    await expect(
      t.app.dossiers.downloadSubmissionDocument(province, { dossierId: down.dossierId, submissionNumber: 1, document: "registration_form" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("Quản trị sees no hồ sơ and no Chủ thể (story 83)", async () => {
    const up = await f.forwarded(ward, setId);
    const admin = await f.admin();

    await expect(t.app.dossiers.get(admin, { dossierId: up.dossierId })).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.dossiers.list(admin)).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.dossiers.provinceOverview(admin)).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.entities.getEntity(admin, { entityId: entityIdOf(up.a) })).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.dossiers.downloadSignedWardReport(admin, { dossierId: up.dossierId })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("L06 số liệu tổng hợp of hồ sơ not yet at the province (story 79)", () => {
  it("counts hồ sơ by xã and state, without any row of a hồ sơ, leaving out Nháp and what reached the province", async () => {
    const before = await t.app.dossiers.provinceOverview(province);
    const count = (w: string, state: string) => before.find((r) => r.wardId === w && r.state === state)?.count ?? 0;
    const baseline = { x: count(wardId, "submitted_to_ward"), y: count(otherWardId, "submitted_to_ward"), fwd: count(wardId, "forwarded_to_province") };

    await f.submitted(setId);
    await f.submitted(setId);
    await f.submitted(setId, otherWardId);
    await f.forwarded(ward, setId);
    const a = await f.verifiedOwner();
    await t.app.dossiers.create(a, { criteriaSetId: setId });

    const rows = await t.app.dossiers.provinceOverview(province);
    const after = (w: string, state: string) => rows.find((r) => r.wardId === w && r.state === state)?.count ?? 0;
    expect(after(wardId, "submitted_to_ward")).toBe(baseline.x + 2);
    expect(after(otherWardId, "submitted_to_ward")).toBe(baseline.y + 1);
    expect(after(wardId, "forwarded_to_province")).toBe(baseline.fwd);
    expect(rows.some((r) => r.state === "draft")).toBe(false);
    expect(rows.find((r) => r.wardId === otherWardId)).toEqual({ wardId: otherWardId, wardName: "Xã Bình Lợi", state: "submitted_to_ward", count: after(otherWardId, "submitted_to_ward") });
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(["count", "state", "wardId", "wardName"]);
  });

  it("is for the Cán bộ Sở only", async () => {
    await expect(t.app.dossiers.provinceOverview(ward)).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.dossiers.provinceOverview((await f.submitted(setId)).a)).rejects.toMatchObject({ code: "forbidden" });
  });
});

const RETURN = { deadline: "2026-10-31", items: [{ content: "Bổ sung phiếu kiểm nghiệm chỉ tiêu vi sinh" }, { content: "Ảnh nhãn sản phẩm đúng quy định" }] };

describe("L04 Sở trả về (stories 57, 58)", () => {
  it("moves Đã chuyển tỉnh to Yêu cầu bổ sung with the nội dung and hạn bổ sung, on the timeline, audit and outbox; the Sở still sees it", async () => {
    const up = await f.forwarded(ward, setId);

    const { version } = await t.app.dossiers.returnFromProvince(province, { dossierId: up.dossierId, expectedVersion: up.version, ...RETURN });

    expect(version).toBe(up.version + 1);
    const seen = await t.app.dossiers.get(province, { dossierId: up.dossierId });
    expect(seen).toMatchObject({ state: "supplement_requested", supplementDeadline: new Date("2026-10-31T16:59:59Z"), firstForwardedAt: START });
    const request = (await t.app.dossiers.supplementRequests(up.a, { dossierId: up.dossierId })).at(-1);
    expect(request).toMatchObject({ requestedBy: province.userId, requestedRole: "province_officer", deadline: new Date("2026-10-31T16:59:59Z"), closedAt: null });
    expect(request!.items.map((i) => i.content)).toEqual(RETURN.items.map((i) => i.content));
    expect((await t.app.dossiers.timeline(up.a, { dossierId: up.dossierId })).at(-1)).toMatchObject({
      action: "dossier.province_return",
      fromState: "forwarded_to_province",
      toState: "supplement_requested",
      actorUserId: province.userId,
    });
    const [entry] = await t.app.audit.search(await f.admin(), { action: ["dossier.province_return"], targetId: up.dossierId });
    expect(entry).toMatchObject({ actorUserId: province.userId, actorRole: "province_officer", after: { state: "supplement_requested" } });
    const { rowCount } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.returned_by_province' AND payload->>'dossierId' = $1", [up.dossierId]);
    expect(rowCount).toBe(1);
  });

  it("notifies the Chủ thể and the Cán bộ phụ trách; after the nộp lại the Cán bộ phụ trách hears of it, not the Sở", async () => {
    const up = await f.forwarded(ward, setId);
    const { version } = await t.app.dossiers.returnFromProvince(province, { dossierId: up.dossierId, expectedVersion: up.version, ...RETURN });
    await t.drainJobs();

    expect(await t.app.notifications.list(up.a)).toContainEqual(
      expect.objectContaining({ kind: "dossier_returned_by_province", link: `/chu-the/ho-so/${up.dossierId}` }),
    );
    expect(await t.app.notifications.list(ward)).toContainEqual(expect.objectContaining({ kind: "dossier_returned_by_province", link: `/xa/ho-so/${up.dossierId}` }));
    expect(t.mailbox.to(up.a.email).at(-1)!.text).toContain(`/chu-the/ho-so/${up.dossierId}`);

    await t.app.dossiers.submit(up.a, { dossierId: up.dossierId, expectedVersion: version });
    await t.drainJobs();
    const resubmitted = async (u: UserActor) => (await t.app.notifications.list(u)).filter((n) => n.kind === "dossier_resubmitted" && n.link?.includes(up.dossierId));
    expect(await resubmitted(ward)).toHaveLength(1);
    expect(await resubmitted(province)).toHaveLength(0);
  });

  it("after the nộp lại the hồ sơ is Đã nộp xã again: the xã reviews it, signs a report for the new Phiên bản nộp and gửi tỉnh again", async () => {
    const up = await f.forwarded(ward, setId);
    const { version: returned } = await t.app.dossiers.returnFromProvince(province, { dossierId: up.dossierId, expectedVersion: up.version, ...RETURN });

    const { version: resubmitted } = await t.app.dossiers.submit(up.a, { dossierId: up.dossierId, expectedVersion: returned });

    expect(await t.app.dossiers.get(ward, { dossierId: up.dossierId })).toMatchObject({ state: "submitted_to_ward", supplementDeadline: null, handler: { userId: ward.userId } });
    expect((await t.app.dossiers.supplementRequests(ward, { dossierId: up.dossierId })).at(-1)).toMatchObject({ outcome: "resubmitted" });
    // Still the province's to see while the xã reviews it again (story 78).
    expect(await t.app.dossiers.get(province, { dossierId: up.dossierId })).toMatchObject({ state: "submitted_to_ward" });
    await expect(t.app.dossiers.forwardToProvince(ward, { dossierId: up.dossierId, expectedVersion: resubmitted })).rejects.toMatchObject({ code: "ward_report_missing" });
    const fileId = await f.uploadPdf(ward, "signed_ward_report", "BC lần 2.pdf");
    const { version: signed } = await t.app.dossiers.attachSignedWardReport(ward, { dossierId: up.dossierId, expectedVersion: resubmitted, fileId });
    t.clock.set(new Date("2026-11-02T02:00:00Z"));
    await t.app.dossiers.forwardToProvince(ward, { dossierId: up.dossierId, expectedVersion: signed });

    expect(await t.app.dossiers.get(province, { dossierId: up.dossierId })).toMatchObject({ state: "forwarded_to_province", firstForwardedAt: START });
  });

  it("is refused to anyone but the Cán bộ Sở, outside Đã chuyển tỉnh, without nội dung or with a hạn already past", async () => {
    const up = await f.forwarded(ward, setId);
    const ret = (actor: UserActor, input: Partial<typeof RETURN> & { expectedVersion?: number } = {}) =>
      t.app.dossiers.returnFromProvince(actor, { dossierId: up.dossierId, expectedVersion: up.version, ...RETURN, ...input });

    await expect(ret(ward)).rejects.toMatchObject({ code: "forbidden" });
    await expect(ret(up.a)).rejects.toMatchObject({ code: "forbidden" });
    await expect(ret(await f.admin())).rejects.toMatchObject({ code: "forbidden" });
    await expect(ret(province, { items: [] })).rejects.toMatchObject({ code: "items_required" });
    await expect(ret(province, { deadline: "2026-10-18" })).rejects.toMatchObject({ code: "invalid_deadline" });
    await expect(ret(province, { expectedVersion: up.version - 1 })).rejects.toMatchObject({ code: "version_conflict" });
    await ret(province);
    await expect(ret(province, { expectedVersion: up.version + 1 })).rejects.toMatchObject({ code: "invalid_state" });

    const down = await f.submitted(setId);
    await expect(t.app.dossiers.returnFromProvince(province, { dossierId: down.dossierId, expectedVersion: down.version, ...RETURN })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("L04 đề nghị trả về of the xã (story 59)", () => {
  it("sends the Sở a request with its lý do without changing the state; the Sở and the xã see it as pending until a trả về", async () => {
    const up = await f.forwarded(ward, setId);
    const { rowCount: before } = await db.admin.query("SELECT 1 FROM dossier.dossier_event WHERE dossier_id = $1", [up.dossierId]);

    const { version } = await t.app.dossiers.requestReturn(ward, { dossierId: up.dossierId, expectedVersion: up.version, reason: "  Sai số liệu lao động địa phương  " });

    expect(await t.app.dossiers.get(province, { dossierId: up.dossierId })).toMatchObject({ state: "forwarded_to_province", version });
    const expected = { reason: "Sai số liệu lao động địa phương", requestedBy: { userId: ward.userId, fullName: ward.fullName }, requestedAt: START, pending: true };
    expect(await t.app.dossiers.returnRequests(province, { dossierId: up.dossierId })).toEqual([expect.objectContaining(expected)]);
    expect(await t.app.dossiers.returnRequests(ward, { dossierId: up.dossierId })).toEqual([expect.objectContaining(expected)]);
    // A matter between the xã and the Sở: not on the Chủ thể's timeline.
    const { rowCount: after } = await db.admin.query("SELECT 1 FROM dossier.dossier_event WHERE dossier_id = $1", [up.dossierId]);
    expect(after).toBe(before);
    await expect(t.app.dossiers.returnRequests(up.a, { dossierId: up.dossierId })).rejects.toMatchObject({ code: "forbidden" });
    const [entry] = await t.app.audit.search(await f.admin(), { action: ["dossier.return_request"], targetId: up.dossierId });
    expect(entry).toMatchObject({ actorUserId: ward.userId, metadata: { reason: "Sai số liệu lao động địa phương" } });
    const { rowCount } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.return_requested' AND payload->>'dossierId' = $1", [up.dossierId]);
    expect(rowCount).toBe(1);

    await t.drainJobs();
    expect(await t.app.notifications.list(province)).toContainEqual(expect.objectContaining({ kind: "dossier_return_requested", link: `/so/ho-so/${up.dossierId}` }));

    await t.app.dossiers.returnFromProvince(province, { dossierId: up.dossierId, expectedVersion: version, ...RETURN });
    expect((await t.app.dossiers.returnRequests(province, { dossierId: up.dossierId }))[0]).toMatchObject({ pending: false });
  });

  it("needs a lý do, a Cán bộ xã of the hồ sơ's xã and a hồ sơ Đã chuyển tỉnh", async () => {
    const up = await f.forwarded(ward, setId);
    const ask = (actor: UserActor, reason = "Phát hiện sai sót") => t.app.dossiers.requestReturn(actor, { dossierId: up.dossierId, expectedVersion: up.version, reason });

    await expect(ask(ward, "   ")).rejects.toMatchObject({ code: "reason_required" });
    await expect(ask(province)).rejects.toMatchObject({ code: "forbidden" });
    await expect(ask(up.a)).rejects.toMatchObject({ code: "forbidden" });
    await expect(ask(await f.staff("ward_officer", otherWardId))).rejects.toMatchObject({ code: "not_found" });
    const s = await f.submitted(setId);
    const { version } = await t.app.dossiers.receive(ward, { dossierId: s.dossierId, expectedVersion: s.version });
    await expect(t.app.dossiers.requestReturn(ward, { dossierId: s.dossierId, expectedVersion: version, reason: "Thử" })).rejects.toMatchObject({ code: "invalid_state" });
  });

  it("keeps a đề nghị trả về once sent: the DB refuses to change or delete it", async () => {
    const up = await f.forwarded(ward, setId);
    await t.app.dossiers.requestReturn(ward, { dossierId: up.dossierId, expectedVersion: up.version, reason: "Sai sót" });

    await expect(db.app.query("UPDATE dossier.return_request SET reason = 'khác' WHERE dossier_id = $1", [up.dossierId])).rejects.toThrow(/permission denied/);
    await expect(db.app.query("DELETE FROM dossier.return_request WHERE dossier_id = $1", [up.dossierId])).rejects.toThrow(/permission denied/);
  });
});
