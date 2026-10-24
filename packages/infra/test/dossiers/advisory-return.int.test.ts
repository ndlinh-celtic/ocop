import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, hours, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "./fixtures";

/*
 * L10 TM-03 đề nghị trả về of the Tổ tư vấn (#57, spec #49 stories 51 to 55): while it thẩm định a hồ sơ, a
 * Thành viên Tổ tư vấn Phân công on it asks the Sở to trả về the hồ sơ to the xã, with a lý do. The Sở sees the
 * request and trả về through the yêu cầu bổ sung of step 3. When the hồ sơ is back at the province it keeps its
 * Phân công, the nháp Báo cáo Tổ tư vấn and the Phiếu chấm trống, but is Tiếp nhận tại tỉnh and Giao chấm again.
 */

let db: TestDatabase;
let t: TestApp;
let f: ReturnType<typeof fixtures>;
let setId: string;
let ward: UserActor;
let province: UserActor;
let A: Awaited<ReturnType<ReturnType<typeof fixtures>["staffedCouncil"]>>;
const START = new Date("2026-10-19T02:00:00Z");
const RETURN = { deadline: "2026-11-10", items: [{ content: "Bổ sung giấy chứng nhận an toàn thực phẩm" }] };

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n");
  const wardId = (await t.app.org.listWards())[0]!.id;
  f = fixtures(t, () => wardId);
  t.clock.set(START);
  const version = await f.publishedVersion("26/2026/QĐ-TTg");
  setId = version.sets["Rau củ quả"];
  ward = await f.staff("ward_officer", wardId);
  province = await f.staff("province_officer");
  A = await f.staffedCouncil(province, { members: 1, advisors: 2 });
  const roundId = await f.openRound(version.versionId, { gradingMode: "advisory_based", minGraders: 1 });
  await t.app.rounds.assignCouncil(province, { roundId, councilId: A.councilId });
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

/** A hồ sơ in Tổ tư vấn thẩm định, Phân công to the one thành viên chấm and the first Thành viên Tổ tư vấn of A. */
const underReview = () => f.gradingStarted(ward, province, setId, A.secretary, { members: A.members, advisors: [A.advisors[0]!] });

describe("L10 TM-03 the Tổ tư vấn asks the Sở to trả về (stories 51 to 53)", () => {
  it("records the request with its lý do without moving the hồ sơ, off the timeline, audited, and tells the Cán bộ Sở", async () => {
    const d = await underReview();
    const advisor = A.advisors[0]!;
    const { rowCount: before } = await db.admin.query("SELECT 1 FROM dossier.dossier_event WHERE dossier_id = $1", [d.dossierId]);

    const { version } = await t.app.dossiers.requestAdvisoryReturn(advisor, { dossierId: d.dossierId, expectedVersion: d.version, reason: "  Thiếu giấy chứng nhận ATTP  " });

    expect(await t.app.dossiers.get(province, { dossierId: d.dossierId })).toMatchObject({ state: "advisory_review", version });
    const expected = { reason: "Thiếu giấy chứng nhận ATTP", requestedBy: { userId: advisor.userId, fullName: advisor.fullName }, requestedAt: START, pending: true };
    expect(await t.app.dossiers.advisoryReturnRequests(province, { dossierId: d.dossierId })).toEqual([expect.objectContaining(expected)]);
    expect(await t.app.dossiers.advisoryReturnRequests(advisor, { dossierId: d.dossierId })).toEqual([expect.objectContaining(expected)]);
    const { rowCount: after } = await db.admin.query("SELECT 1 FROM dossier.dossier_event WHERE dossier_id = $1", [d.dossierId]);
    expect(after).toBe(before);
    const [entry] = await t.app.audit.search(await f.admin(), { action: ["dossier.advisory_return_request"], targetId: d.dossierId });
    expect(entry).toMatchObject({ actorUserId: advisor.userId, metadata: { reason: "Thiếu giấy chứng nhận ATTP" } });
    const { rowCount } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.advisory_return_requested' AND payload->>'dossierId' = $1", [d.dossierId]);
    expect(rowCount).toBe(1);

    await t.drainJobs();
    expect(await t.app.notifications.list(province)).toContainEqual(expect.objectContaining({ kind: "dossier_advisory_return_requested", link: `/so/ho-so/${d.dossierId}` }));
    expect(t.mailbox.to(province.email).map((m) => m.subject)).toContain("Tổ tư vấn đề nghị trả về một hồ sơ OCOP");
  });
});

describe("L10 TM-03 who reads the đề nghị trả về of the Tổ tư vấn (stories 52, 53)", () => {
  it("is in the Sở's list of hồ sơ to trả về while pending, and is never read by the xã, the Chủ thể or the Vai trò hội đồng", async () => {
    const d = await underReview();
    const other = await underReview();
    const asked = async () => (await t.app.dossiers.list(province, { filter: "advisory_return_requested" })).map((x) => x.id);
    expect(await asked()).not.toContain(d.dossierId);

    await t.app.dossiers.requestAdvisoryReturn(A.advisors[0]!, { dossierId: d.dossierId, expectedVersion: d.version, reason: "Thiếu hồ sơ" });

    expect(await asked()).toContain(d.dossierId);
    expect(await asked()).not.toContain(other.dossierId);
    for (const reader of [ward, d.a, A.members[0]!, A.secretary, A.chair]) {
      await expect(t.app.dossiers.advisoryReturnRequests(reader, { dossierId: d.dossierId })).rejects.toMatchObject({ code: "forbidden" });
    }
    // A Thành viên Tổ tư vấn of the Hội đồng with no Phân công on the hồ sơ does not see it at all.
    await expect(t.app.dossiers.advisoryReturnRequests(A.advisors[1]!, { dossierId: d.dossierId })).rejects.toMatchObject({ code: "not_found" });
    // The xã's own đề nghị list is a separate one.
    expect(await t.app.dossiers.returnRequests(province, { dossierId: d.dossierId })).toEqual([]);
  });

  it("needs a lý do and a Thành viên Tổ tư vấn Phân công on a hồ sơ in Tổ tư vấn thẩm định", async () => {
    const d = await underReview();
    const ask = (actor: UserActor, reason = "Thiếu hồ sơ") => t.app.dossiers.requestAdvisoryReturn(actor, { dossierId: d.dossierId, expectedVersion: d.version, reason });

    await expect(ask(A.advisors[0]!, "  ")).rejects.toMatchObject({ code: "reason_required" });
    await expect(ask(A.advisors[1]!)).rejects.toMatchObject({ code: "not_found" });
    for (const actor of [province, ward, d.a, A.members[0]!, A.secretary]) await expect(ask(actor)).rejects.toMatchObject({ code: "forbidden" });
    await expect(ask(A.advisors[0]!)).resolves.toMatchObject({ version: d.version + 1 });
    await expect(ask(A.advisors[0]!)).rejects.toMatchObject({ code: "version_conflict" });
  });

  it("keeps a đề nghị once sent: the DB refuses to change or delete it", async () => {
    const d = await underReview();
    await t.app.dossiers.requestAdvisoryReturn(A.advisors[0]!, { dossierId: d.dossierId, expectedVersion: d.version, reason: "Thiếu hồ sơ" });

    await expect(db.app.query("UPDATE dossier.advisory_return_request SET reason = 'khác' WHERE dossier_id = $1", [d.dossierId])).rejects.toThrow(/permission denied/);
    await expect(db.app.query("DELETE FROM dossier.advisory_return_request WHERE dossier_id = $1", [d.dossierId])).rejects.toThrow(/permission denied/);
  });
});

describe("L10 TM-03 the Sở trả về a hồ sơ the Tổ tư vấn thẩm định (stories 52 to 55)", () => {
  it("moves it to Yêu cầu bổ sung through the yêu cầu bổ sung of step 3, which the Chủ thể answers like any other", async () => {
    const d = await underReview();
    const { version: asked } = await t.app.dossiers.requestAdvisoryReturn(A.advisors[0]!, { dossierId: d.dossierId, expectedVersion: d.version, reason: "Thiếu hồ sơ" });

    const { version } = await t.app.dossiers.returnFromProvince(province, { dossierId: d.dossierId, expectedVersion: asked, ...RETURN });

    expect(await t.app.dossiers.get(d.a, { dossierId: d.dossierId })).toMatchObject({ state: "supplement_requested", version, provinceReceivedAt: null, gradingStartedAt: null });
    const [request] = await t.app.dossiers.supplementRequests(d.a, { dossierId: d.dossierId });
    expect(request).toMatchObject({ requestedRole: "province_officer", items: [expect.objectContaining({ content: RETURN.items[0]!.content })] });
    expect(await t.app.dossiers.advisoryReturnRequests(province, { dossierId: d.dossierId })).toEqual([expect.objectContaining({ pending: false })]);
    expect((await t.app.dossiers.list(province, { filter: "advisory_return_requested" })).map((x) => x.id)).not.toContain(d.dossierId);
    const [entry] = await t.app.audit.search(await f.admin(), { action: ["dossier.province_return"], targetId: d.dossierId });
    expect(entry).toMatchObject({ before: { state: "advisory_review" }, after: { state: "supplement_requested" } });
    const outbox = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'dossier.returned_by_province' AND payload->>'dossierId' = $1", [d.dossierId]);
    expect(outbox.rows).toEqual([{ payload: expect.objectContaining({ from: "advisory_review", to: "supplement_requested" }) }]);
    // The Chủ thể's timeline shows the trả về, never the đề nghị of the Tổ tư vấn.
    const actions = (await t.app.dossiers.timeline(d.a, { dossierId: d.dossierId })).map((e) => e.action);
    expect(actions).toContain("dossier.province_return");
    expect(actions).not.toContain("dossier.advisory_return_request");
  });

  it("back at the province keeps the Phân công, the nháp and the Phiếu chấm trống, but is Tiếp nhận tại tỉnh and Giao chấm again", async () => {
    const d = await underReview();
    const advisor = A.advisors[0]!;
    const ws = await t.app.scoring.advisoryReport(advisor, { dossierId: d.dossierId });
    await t.app.scoring.saveAdvisoryDraft(advisor, {
      dossierId: d.dossierId,
      draftVersion: 0,
      lines: ws.criteria.map((c) => ({ criterionId: c.criterionId, levelId: c.levels[0]!.id, basis: "Căn cứ", evidenceFileIds: [], evidenceAssessment: null })),
      summary: "Tóm tắt",
      notes: "",
      attachmentFileIds: [],
    });
    let { version } = await t.app.dossiers.requestAdvisoryReturn(advisor, { dossierId: d.dossierId, expectedVersion: ws.dossierVersion, reason: "Lần 1" });
    const sheetsBefore = await sheets(d.dossierId);
    const assignmentsBefore = await t.app.councils.assignments(A.secretary, { dossierId: d.dossierId });
    ({ version } = await t.app.dossiers.returnFromProvince(province, { dossierId: d.dossierId, expectedVersion: version, ...RETURN }));

    // The Tổ tư vấn still sees the hồ sơ, read only.
    expect(await t.app.dossiers.get(advisor, { dossierId: d.dossierId })).toMatchObject({ state: "supplement_requested" });
    ({ version } = await t.app.dossiers.submit(d.a, { dossierId: d.dossierId, expectedVersion: version }));
    const fileId = await f.uploadPdf(ward, "signed_ward_report", "BC xã đã ký lần 2.pdf");
    ({ version } = await t.app.dossiers.attachSignedWardReport(ward, { dossierId: d.dossierId, expectedVersion: version, fileId }));
    ({ version } = await t.app.dossiers.forwardToProvince(ward, { dossierId: d.dossierId, expectedVersion: version }));

    expect(await t.app.dossiers.get(province, { dossierId: d.dossierId })).toMatchObject({ state: "forwarded_to_province", provinceReceivedAt: null, gradingStartedAt: null });
    await expect(t.app.councils.startGrading(A.secretary, { dossiers: [{ dossierId: d.dossierId, expectedVersion: version }] })).rejects.toMatchObject({ code: "not_province_received" });
    expect(await t.app.councils.assignments(A.secretary, { dossierId: d.dossierId })).toEqual(assignmentsBefore);
    await expect(t.app.scoring.saveAdvisoryDraft(advisor, { dossierId: d.dossierId, draftVersion: 1, lines: [], summary: "", notes: "", attachmentFileIds: [] })).rejects.toMatchObject({
      code: "invalid_state",
    });

    t.clock.advance(hours(24));
    ({ version } = await t.app.dossiers.receiveAtProvince(province, { dossierId: d.dossierId, expectedVersion: version }));
    const [again] = (await t.app.councils.startGrading(A.secretary, { dossiers: [{ dossierId: d.dossierId, expectedVersion: version }] })).dossiers;

    expect(again).toMatchObject({ state: "advisory_review" });
    expect(await t.app.councils.assignments(A.secretary, { dossierId: d.dossierId })).toEqual(assignmentsBefore);
    expect(await sheets(d.dossierId)).toEqual(sheetsBefore);
    const kept = await t.app.scoring.advisoryReport(advisor, { dossierId: d.dossierId });
    expect(kept.draftVersion).toBe(1);
    expect(kept.criteria.every((c) => c.line?.basis === "Căn cứ")).toBe(true);
    // The đề nghị of the earlier lượt is no longer pending; a new one is.
    await t.app.dossiers.requestAdvisoryReturn(advisor, { dossierId: d.dossierId, expectedVersion: again!.version, reason: "Lần 2" });
    expect((await t.app.dossiers.advisoryReturnRequests(province, { dossierId: d.dossierId })).map((r) => [r.reason, r.pending])).toEqual([
      ["Lần 1", false],
      ["Lần 2", true],
    ]);
  });

  it("lets the Thư ký thay or bổ sung a Phân công kept from the earlier lượt before Giao chấm again (stories 34, 36, 54)", async () => {
    const d = await underReview();
    let { version } = await t.app.dossiers.returnFromProvince(province, { dossierId: d.dossierId, expectedVersion: d.version, ...RETURN });
    ({ version } = await t.app.dossiers.submit(d.a, { dossierId: d.dossierId, expectedVersion: version }));
    const fileId = await f.uploadPdf(ward, "signed_ward_report", "BC xã đã ký lần 2.pdf");
    ({ version } = await t.app.dossiers.attachSignedWardReport(ward, { dossierId: d.dossierId, expectedVersion: version, fileId }));
    ({ version } = await t.app.dossiers.forwardToProvince(ward, { dossierId: d.dossierId, expectedVersion: version }));
    const [gone, comer] = A.advisors as [UserActor, UserActor];

    ({ version } = await t.app.councils.replaceAssignment(A.secretary, { dossierId: d.dossierId, expectedVersion: version, userId: gone.userId, newUserId: comer.userId, reason: "Xung đột lợi ích" }));

    await expect(t.app.dossiers.get(gone, { dossierId: d.dossierId })).rejects.toMatchObject({ code: "not_found" });
    expect((await t.app.councils.assignments(A.secretary, { dossierId: d.dossierId })).map((a) => [a.userId, a.kind])).toEqual([
      [A.members[0]!.userId, "member"],
      [comer.userId, "advisory"],
    ]);
    t.clock.advance(hours(24));
    ({ version } = await t.app.dossiers.receiveAtProvince(province, { dossierId: d.dossierId, expectedVersion: version }));
    const [again] = (await t.app.councils.startGrading(A.secretary, { dossiers: [{ dossierId: d.dossierId, expectedVersion: version }] })).dossiers;
    expect(again).toMatchObject({ state: "advisory_review" });
    expect(await t.app.dossiers.get(comer, { dossierId: d.dossierId })).toMatchObject({ state: "advisory_review" });
  });
});

const sheets = async (dossierId: string) =>
  (await db.admin.query("SELECT id, assignment_id, state, attempt, version FROM scoring.score_sheet WHERE dossier_id = $1 ORDER BY id", [dossierId])).rows;
