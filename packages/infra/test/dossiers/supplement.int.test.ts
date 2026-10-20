import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import PizZip from "pizzip";
import type { SubmissionDocument, UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "./fixtures";

let db: TestDatabase;
let t: TestApp;
let wardX: string;
let f: ReturnType<typeof fixtures>;
let sets: Record<"Rau củ quả" | "Thịt tươi", string>;
let officerX: UserActor;
const START = new Date("2026-10-19T02:00:00Z");

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n00002,Xã Bình Lợi\n");
  const wards = await t.app.org.listWards();
  wardX = wards.find((w) => w.name === "Xã An Phú")!.id;
  f = fixtures(t, () => wardX);
  t.clock.set(START);
  const version = await f.publishedVersion("26/2026/QĐ-TTg");
  sets = version.sets;
  await f.openRound(version.versionId);
  officerX = await f.staff("ward_officer", wardX);
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

/** A hồ sơ Đã nộp xã, Tiếp nhận by officerX. */
async function received() {
  const s = await f.submitted(sets["Rau củ quả"]);
  const { version } = await t.app.dossiers.receive(officerX, { dossierId: s.dossierId, expectedVersion: s.version });
  return { ...s, version };
}

describe("L04 XA-05 yêu cầu bổ sung (story 50)", () => {
  it("moves a received hồ sơ Đã nộp xã into Yêu cầu bổ sung with its nội dung and a hạn bổ sung to 23:59:59 giờ Việt Nam", async () => {
    const { dossierId, version } = await received();

    const after = await t.app.dossiers.requestSupplement(officerX, {
      dossierId,
      expectedVersion: version,
      deadline: "2026-10-31",
      items: [{ content: "Bổ sung phiếu kiểm nghiệm vi sinh" }],
    });

    expect(after.version).toBe(version + 1);
    expect(await t.app.dossiers.get(officerX, { dossierId })).toMatchObject({
      state: "supplement_requested",
      supplementDeadline: new Date("2026-10-31T16:59:59Z"),
    });
  });

  it("keeps each nội dung, tied to a Tiêu chí of the hồ sơ or a loại giấy tờ, for the Chủ thể to read; with timeline, audit and outbox", async () => {
    const { a, dossierId, version } = await received();
    const { set } = await t.app.dossiers.selfAssessment(a, { dossierId });
    const criterion = set.parts[0]!.sections[0]!.items[0]!;

    await t.app.dossiers.requestSupplement(officerX, {
      dossierId,
      expectedVersion: version,
      deadline: "2026-10-31",
      items: [
        { content: "Bổ sung phiếu kiểm nghiệm", criterionId: criterion.id },
        { content: "Giấy phép kinh doanh mới", legalDocumentTypeCode: "business_registration" },
        { content: "Ảnh bao bì" },
      ],
    });

    const [request] = await t.app.dossiers.supplementRequests(a, { dossierId });
    expect(request).toMatchObject({
      requestedBy: officerX.userId,
      requestedAt: START,
      deadline: new Date("2026-10-31T16:59:59Z"),
      closedAt: null,
      items: [
        { position: 1, content: "Bổ sung phiếu kiểm nghiệm", criterionId: criterion.id, criterion: { code: "1.1", name: "Tiêu chí thử" }, legalDocumentTypeCode: null, response: "" },
        { position: 2, legalDocumentTypeCode: "business_registration", legalDocumentTypeName: expect.stringContaining("Giấy chứng nhận đăng ký"), criterionId: null },
        { position: 3, content: "Ảnh bao bì", criterionId: null, legalDocumentTypeCode: null },
      ],
    });
    expect((await t.app.dossiers.timeline(a, { dossierId })).at(-1)).toMatchObject({
      action: "dossier.supplement.request",
      fromState: "submitted_to_ward",
      toState: "supplement_requested",
      actorUserId: officerX.userId,
    });
    expect(await t.app.audit.search(await f.admin(), { action: ["dossier.supplement.request"], targetId: dossierId })).toHaveLength(1);
    const { rows } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.supplement_requested' AND payload->>'dossierId' = $1", [dossierId]);
    expect(rows).toHaveLength(1);
  });

  it("refuses before Tiếp nhận, without nội dung, with a past hạn, with a Tiêu chí of another Bộ tiêu chí, and by the Chủ thể", async () => {
    const s = await f.submitted(sets["Rau củ quả"]);
    const ask = (actor: UserActor, dossierId: string, expectedVersion: number, extra: object = {}) =>
      t.app.dossiers.requestSupplement(actor, { dossierId, expectedVersion, deadline: "2026-10-31", items: [{ content: "Bổ sung" }], ...extra });
    await expect(ask(officerX, s.dossierId, s.version)).rejects.toMatchObject({ code: "not_received" });

    const { dossierId, version, a } = await received();
    const other = await f.submitted(sets["Thịt tươi"]);
    const { set } = await t.app.dossiers.selfAssessment(other.a, { dossierId: other.dossierId });
    await expect(ask(officerX, dossierId, version, { items: [] })).rejects.toMatchObject({ code: "items_required" });
    await expect(ask(officerX, dossierId, version, { deadline: "2026-10-18" })).rejects.toMatchObject({ code: "invalid_deadline" });
    await expect(ask(officerX, dossierId, version, { items: [{ content: "x", criterionId: set.parts[0]!.sections[0]!.items[0]!.id }] })).rejects.toMatchObject({
      code: "criterion_not_in_set",
    });
    await expect(ask(a, dossierId, version)).rejects.toMatchObject({ code: "forbidden" });
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ state: "submitted_to_ward", version });
  });

  it("accepts the hạn bổ sung of today, which runs to 23:59:59 giờ Việt Nam", async () => {
    const { dossierId, version } = await received();
    t.clock.set(new Date("2026-10-19T16:30:00Z")); // 23:30 on 19/10 in Việt Nam
    await t.app.dossiers.requestSupplement(officerX, { dossierId, expectedVersion: version, deadline: "2026-10-19", items: [{ content: "Bổ sung" }] });
    expect((await t.app.dossiers.get(officerX, { dossierId })).supplementDeadline).toEqual(new Date("2026-10-19T16:59:59Z"));
  });
});

/** A received hồ sơ the xã has asked for more on, until the given day. */
async function supplementRequested(deadline = "2026-10-31") {
  const r = await received();
  const { version } = await t.app.dossiers.requestSupplement(officerX, {
    dossierId: r.dossierId,
    expectedVersion: r.version,
    deadline,
    items: [{ content: "Bổ sung phiếu kiểm nghiệm" }, { content: "Ảnh bao bì" }],
  });
  return { ...r, version };
}

describe("L04 CT-11 bổ sung hồ sơ (story 51)", () => {
  it("lets the Chủ thể edit the bản làm việc, add minh chứng and answer each nội dung while Yêu cầu bổ sung", async () => {
    const { a, dossierId, version: v0 } = await supplementRequested();

    let { version } = await t.app.dossiers.updateProduct(a, { dossierId, expectedVersion: v0, description: "Bưởi VietGAP, đã bổ sung" });
    const fileId = await f.uploadPdf(a, "evidence", "Phiếu kiểm nghiệm.pdf");
    ({ version } = await t.app.dossiers.addEvidenceFile(a, { dossierId, expectedVersion: version, fileId }));
    const [request] = await t.app.dossiers.supplementRequests(a, { dossierId });
    t.clock.set(new Date("2026-10-20T03:00:00Z"));
    ({ version } = await t.app.dossiers.respondSupplementItem(a, { dossierId, expectedVersion: version, itemId: request!.items[0]!.id, response: "Đã tải phiếu kiểm nghiệm" }));

    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ state: "supplement_requested", version, description: "Bưởi VietGAP, đã bổ sung" });
    expect((await t.app.dossiers.get(a, { dossierId })).evidence.map((e) => e.fileId)).toContain(fileId);
    const [after] = await t.app.dossiers.supplementRequests(officerX, { dossierId });
    expect(after!.items).toMatchObject([
      { response: "Đã tải phiếu kiểm nghiệm", respondedAt: new Date("2026-10-20T03:00:00Z"), respondedBy: a.userId },
      { response: "", respondedAt: null },
    ]);
  });

  it("refuses an answer from the Cán bộ xã, and to a nội dung of another hồ sơ", async () => {
    const { a, dossierId, version } = await supplementRequested();
    const other = await supplementRequested();
    const [request] = await t.app.dossiers.supplementRequests(a, { dossierId });
    const [otherRequest] = await t.app.dossiers.supplementRequests(other.a, { dossierId: other.dossierId });
    const answer = (actor: UserActor, itemId: string) => t.app.dossiers.respondSupplementItem(actor, { dossierId, expectedVersion: version, itemId, response: "Trả lời" });

    await expect(answer(officerX, request!.items[0]!.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(answer(a, otherRequest!.items[0]!.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(answer(a, "not-a-uuid")).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("L04 CT-11 nộp lại (stories 52 to 54)", () => {
  it("creates Phiên bản nộp 2 with freshly generated văn bản, leaving Phiên bản nộp 1 and its văn bản untouched", async () => {
    const { a, dossierId, version: v0 } = await supplementRequested();
    const [v1Before] = await t.app.dossiers.submissions(a, { dossierId });
    const formV1 = await documentBytes(a, dossierId, 1, "registration_form");
    const reportV1 = await documentBytes(a, dossierId, 1, "self_assessment_report");
    const { version } = await t.app.dossiers.updateProduct(a, { dossierId, expectedVersion: v0, process: "Quy trình đã bổ sung" });
    t.clock.set(new Date("2026-10-25T03:00:00Z"));

    const result = await t.app.dossiers.submit(a, { dossierId, expectedVersion: version });

    expect(result).toEqual({ version: version + 1, submissionNumber: 2 });
    const [v1, v2] = await t.app.dossiers.submissions(a, { dossierId });
    expect(v1).toEqual(v1Before);
    expect(v2).toMatchObject({ number: 2, submittedAt: new Date("2026-10-25T03:00:00Z"), wardId: wardX, snapshot: { product: { process: "Quy trình đã bổ sung" } } });
    expect(v2!.snapshot.documents.registrationForm).not.toBe(v1!.snapshot.documents.registrationForm);
    expect(v2!.snapshot.documents.selfAssessmentReport).not.toBe(v1!.snapshot.documents.selfAssessmentReport);
    expect(await documentBytes(a, dossierId, 1, "registration_form")).toEqual(formV1);
    expect(await documentBytes(a, dossierId, 1, "self_assessment_report")).toEqual(reportV1);
    expect(docxText(formV1)).not.toContain("Quy trình đã bổ sung");
    const formV2 = docxText(await documentBytes(a, dossierId, 2, "registration_form"));
    expect(formV2).toContain("Quy trình sản xuất: Quy trình đã bổ sung");
    expect(formV2).toContain("Phiên bản nộp số 2, nộp ngày 25/10/2026.");
  });

  it("returns the hồ sơ to Đã nộp xã keeping its Tiếp nhận and Cán bộ phụ trách, and closes the yêu cầu bổ sung", async () => {
    const { a, dossierId, version } = await supplementRequested();
    const before = await t.app.dossiers.get(officerX, { dossierId });

    await t.app.dossiers.submit(a, { dossierId, expectedVersion: version });

    expect(await t.app.dossiers.get(officerX, { dossierId })).toMatchObject({
      state: "submitted_to_ward",
      wardId: wardX,
      roundId: before.roundId,
      receivedAt: before.receivedAt,
      receivedBy: officerX.userId,
      handlerUserId: officerX.userId,
      supplementDeadline: null,
      latestSubmission: { number: 2 },
    });
    expect(await t.app.dossiers.supplementRequests(a, { dossierId })).toMatchObject([{ closedAt: START, outcome: "resubmitted" }]);
    expect((await t.app.dossiers.timeline(a, { dossierId })).at(-1)).toMatchObject({
      action: "dossier.resubmit",
      fromState: "supplement_requested",
      toState: "submitted_to_ward",
      metadata: { submissionNumber: 2 },
    });
    expect(await t.app.audit.search(await f.admin(), { action: ["dossier.resubmit"], targetId: dossierId })).toHaveLength(1);
    const { rows } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.resubmitted' AND payload->>'dossierId' = $1", [dossierId]);
    expect(rows).toHaveLength(1);
  });

  it("nộp lại after the Hạn nộp xã while the hạn bổ sung lasts (story 53)", async () => {
    const { a, dossierId, version } = await supplementRequested("2026-12-05");
    // Past the Hạn nộp xã of 30/11: a first nộp is no longer taken (the đợt is left open for the other tests).
    t.clock.set(new Date("2026-12-01T01:00:00Z"));
    const late = await f.verifiedOwner();
    const draft = await t.app.dossiers.create(late, { criteriaSetId: sets["Rau củ quả"] });
    expect((await t.app.dossiers.submissionCheck(late, { dossierId: draft.dossierId })).blockers).toContainEqual(expect.objectContaining({ code: "no_open_round" }));

    expect((await t.app.dossiers.submissionCheck(a, { dossierId })).blockers).toEqual([]);
    expect(await t.app.dossiers.submit(a, { dossierId, expectedVersion: version })).toMatchObject({ submissionNumber: 2 });
  });

  it("refuses nộp lại once the hạn bổ sung has passed, its last second still counting", async () => {
    const { a, dossierId, version } = await supplementRequested("2026-10-31");
    t.clock.set(new Date("2026-10-31T17:00:00Z"));

    expect((await t.app.dossiers.submissionCheck(a, { dossierId })).blockers).toMatchObject([{ code: "supplement_deadline_passed" }]);
    await expect(t.app.dossiers.submit(a, { dossierId, expectedVersion: version })).rejects.toMatchObject({ code: "supplement_deadline_passed" });

    t.clock.set(new Date("2026-10-31T16:59:59Z"));
    expect(await t.app.dossiers.submit(a, { dossierId, expectedVersion: version })).toMatchObject({ submissionNumber: 2 });
  });

  it("still checks the conditions of nộp: a Tiêu chí without tự chấm blocks nộp lại", async () => {
    const { a, dossierId, version: v0 } = await supplementRequested();
    const { set } = await t.app.dossiers.selfAssessment(a, { dossierId });
    const criterion = set.parts[0]!.sections[0]!.items[0]!;
    const { version } = await t.app.dossiers.selfScore(a, { dossierId, expectedVersion: v0, criterionId: criterion.id, levelId: null });

    await expect(t.app.dossiers.submit(a, { dossierId, expectedVersion: version })).rejects.toMatchObject({ code: "submission_blocked" });
    expect(await t.app.dossiers.get(a, { dossierId })).toMatchObject({ state: "supplement_requested", version });
  });
});

describe("L04 XA-05 đóng hồ sơ không bổ sung (story 56)", () => {
  it("closes as Không đạt sơ bộ with lý do Không bổ sung, only once the hạn bổ sung has passed", async () => {
    const { a, dossierId, version } = await supplementRequested("2026-10-31");
    const close = (actor: UserActor) => t.app.dossiers.closeUnsupplemented(actor, { dossierId, expectedVersion: version });
    t.clock.set(new Date("2026-10-31T16:59:59Z"));
    await expect(close(officerX)).rejects.toMatchObject({ code: "supplement_deadline_not_passed" });

    t.clock.set(new Date("2026-11-01T02:00:00Z"));
    await expect(close(a)).rejects.toMatchObject({ code: "forbidden" });
    const after = await close(officerX);

    expect(await t.app.dossiers.get(officerX, { dossierId })).toMatchObject({ state: "rejected_preliminary", version: after.version, supplementDeadline: null });
    expect((await t.app.dossiers.timeline(a, { dossierId })).at(-1)).toMatchObject({
      action: "dossier.supplement.close",
      fromState: "supplement_requested",
      toState: "rejected_preliminary",
      actorUserId: officerX.userId,
      reason: "Không bổ sung",
    });
    expect((await t.app.dossiers.get(a, { dossierId })).rejection).toMatchObject({ kind: "preliminary_reason", reasonCode: "no_supplement", text: "Không bổ sung" });
    expect(await t.app.dossiers.supplementRequests(a, { dossierId })).toMatchObject([{ closedAt: new Date("2026-11-01T02:00:00Z"), outcome: "closed_unsupplemented" }]);
    expect(await t.app.audit.search(await f.admin(), { action: ["dossier.supplement.close"], targetId: dossierId })).toHaveLength(1);
    await expect(t.app.dossiers.submit(a, { dossierId, expectedVersion: after.version })).rejects.toMatchObject({ code: "invalid_state" });
  });
});

describe("L04 thông báo yêu cầu bổ sung và nộp lại (stories 42, 51, 54, 86)", () => {
  // Notices of one hồ sơ may share a timestamp, so they are picked by kind rather than by order.
  const noticeOf = async (actor: UserActor, dossierId: string, kind: string) =>
    (await t.app.notifications.list(actor)).filter((n) => n.kind === kind && n.link?.endsWith(dossierId));

  it("tells the Chủ thể, in the app and by email, that the xã asks for more", async () => {
    const { a, dossierId } = await supplementRequested();
    await t.drainJobs();

    expect(await noticeOf(a, dossierId, "dossier_supplement_requested")).toMatchObject([{ link: `/chu-the/ho-so/${dossierId}` }]);
    // The email of the Tiếp nhận goes out in the same drain, in either order.
    const mail = t.mailbox.to(a.email).find((m) => m.subject.includes("yêu cầu bổ sung"));
    expect(mail!.text).toContain(`/chu-the/ho-so/${dossierId}`);
  });

  it("tells the Chủ thể that its hồ sơ was closed for Không bổ sung", async () => {
    const { a, dossierId, version } = await supplementRequested("2026-10-31");
    t.clock.set(new Date("2026-11-01T02:00:00Z"));
    await t.app.dossiers.closeUnsupplemented(officerX, { dossierId, expectedVersion: version });
    await t.drainJobs();

    expect(await noticeOf(a, dossierId, "dossier_rejected_preliminary")).toMatchObject([{ body: expect.stringContaining("Không bổ sung") }]);
    expect(t.mailbox.to(a.email).some((m) => m.subject.includes("Không đạt sơ bộ"))).toBe(true);
  });

  it("tells who asked and the Cán bộ phụ trách, once each, that the Chủ thể nộp lại; other Cán bộ xã hear nothing", async () => {
    const handler = await f.staff("ward_officer", wardX);
    const bystander = await f.staff("ward_officer", wardX);
    const { a, dossierId, version: v0 } = await received();
    const { version: v1 } = await t.app.dossiers.changeHandler(officerX, { dossierId, expectedVersion: v0, handlerUserId: handler.userId });
    const { version } = await t.app.dossiers.requestSupplement(officerX, { dossierId, expectedVersion: v1, deadline: "2026-10-31", items: [{ content: "Bổ sung" }] });
    await t.drainJobs();

    await t.app.dossiers.submit(a, { dossierId, expectedVersion: version });
    await t.drainJobs();

    for (const officer of [officerX, handler]) {
      expect(await noticeOf(officer, dossierId, "dossier_resubmitted")).toMatchObject([{ link: `/xa/ho-so/${dossierId}` }]);
      expect(t.mailbox.to(officer.email).filter((m) => m.subject.includes("nộp lại") && m.text.includes(`/xa/ho-so/${dossierId}`))).toHaveLength(1);
    }
    expect(await noticeOf(bystander, dossierId, "dossier_resubmitted")).toEqual([]);
  });
});

describe("L04 yêu cầu bổ sung in the database, as the app user", () => {
  it("refuses changing what was asked or its hạn, and any change once the request is closed", async () => {
    const { a, dossierId, version } = await supplementRequested();
    const [request] = await t.app.dossiers.supplementRequests(a, { dossierId });
    const item = request!.items[0]!.id;
    await expect(db.app.query("UPDATE dossier.supplement_request SET deadline = now() WHERE id = $1", [request!.id])).rejects.toThrow(/only changes by being closed/);
    await expect(db.app.query("UPDATE dossier.supplement_item SET content = 'khác' WHERE id = $1", [item])).rejects.toThrow(/only the answer/);
    await expect(db.app.query("DELETE FROM dossier.supplement_item WHERE id = $1", [item])).rejects.toThrow(/permission denied/);

    await t.app.dossiers.submit(a, { dossierId, expectedVersion: version });

    await expect(db.app.query("UPDATE dossier.supplement_item SET response = 'muộn' WHERE id = $1", [item])).rejects.toThrow(/only the answer/);
    await expect(db.app.query("UPDATE dossier.supplement_request SET closed_at = now() WHERE id = $1", [request!.id])).rejects.toThrow(/only changes by being closed/);
  });
});

async function documentBytes(actor: UserActor, dossierId: string, submissionNumber: number, document: SubmissionDocument) {
  const { url } = await t.app.dossiers.downloadSubmissionDocument(actor, { dossierId, submissionNumber, document });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** The text of a DOCX body, tags stripped. */
const docxText = (bytes: Uint8Array) =>
  new PizZip(bytes)
    .file("word/document.xml")!
    .asText()
    .replace(/<[^>]+>/g, "");
