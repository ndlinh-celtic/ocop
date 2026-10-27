import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonymous, createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const PASSWORD = "mat-khau-can-bo-1";
const JOB = systemActor("rounds.close-due");
let published: string;
let officer: Awaited<ReturnType<typeof staff>>;

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  published = await importDraft();
  await t.app.criteria.publishVersion(await admin(), { versionId: published });
  officer = await staff();
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

const admin = () => t.signInAs(ADMIN.email, ADMIN.password);

/** A Cán bộ Sở created through the real activation flow. */
async function staff() {
  const email = "can-bo-so@tinh.gov.vn";
  const a = await admin();
  const { userId } = await t.app.identity.createStaffUser(a, { email, fullName: "Cán Bộ Sở" });
  await t.drainJobs();
  const token = /kich-hoat\?token=([\w-]+)/.exec(t.mailbox.to(email).at(-1)!.text)![1]!;
  await t.app.identity.activateAccount(anonymous(), { token, password: PASSWORD });
  await t.app.identity.grantRole(a, { userId, role: "province_officer", scopeId: null });
  return t.signInAs(email, PASSWORD);
}

/** A one-set Phiên bản tiêu chí that passes the check, imported as a draft. */
async function importDraft() {
  const content = JSON.stringify({
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
          },
        ],
      },
    ],
  });
  return (await t.app.criteria.importVersion(await admin(), { fileName: "thu.json", content })).versionId;
}

/** A valid Đợt đánh giá as the form sends it; the test clock starts on 19/10/2026. */
const roundInput = (over: Record<string, unknown> = {}) => ({
  name: "Đợt đánh giá năm 2026",
  year: 2026,
  submissionDeadline: "2026-11-30",
  forwardingDeadline: "2026-12-15",
  evaluationDeadline: "2027-01-31",
  criteriaVersionId: published,
  gradingMode: "direct" as const,
  aggregation: { method: "mean" as const, minGraders: 5, deviationFlagPoints: 15 },
  ...over,
});

const round = (roundId: string) => t.app.rounds.getRound(officer, { roundId });
const events = async (type: string, roundId: string) =>
  (await db.admin.query("SELECT payload FROM platform.outbox WHERE type = $1 AND payload->>'roundId' = $2 ORDER BY id", [type, roundId])).rows.map(
    (r) => r.payload,
  );

describe("L07 gia hạn Hạn gửi tỉnh của đợt Đang nhận nộp", () => {
  let roundId: string;
  beforeAll(async () => {
    ({ roundId } = await t.app.rounds.createRound(officer, roundInput({ name: "Đợt gia hạn" })));
    await t.app.rounds.openRound(officer, { roundId });
  });

  it("moves Hạn gửi tỉnh to the end of the new day and keeps the history", async () => {
    t.clock.set(new Date("2026-11-02T03:00:00Z"));
    const result = await t.app.rounds.extendDeadline(officer, {
      roundId,
      deadline: "forwarding",
      newDate: "2026-12-20",
      reason: "  Nhiều xã đề nghị thêm thời gian  ",
    });
    expect(result).toEqual({ extensionId: expect.any(String) });
    expect(await round(roundId)).toMatchObject({ status: "open_for_submission", forwardingDeadline: new Date("2026-12-20T16:59:59Z") });
    expect(await t.app.rounds.listDeadlineExtensions(officer, { roundId })).toEqual([
      {
        id: result.extensionId,
        roundId,
        deadline: "forwarding",
        previousDeadline: new Date("2026-12-15T16:59:59Z"),
        newDeadline: new Date("2026-12-20T16:59:59Z"),
        reason: "Nhiều xã đề nghị thêm thời gian",
        extendedAt: new Date("2026-11-02T03:00:00Z"),
        extendedBy: officer.userId,
        extendedByName: "Cán Bộ Sở",
      },
    ]);
  });

  it("emits round.deadline_extended and audits it with the reason", async () => {
    expect(await events("round.deadline_extended", roundId)).toEqual([
      {
        roundId,
        extensionId: expect.any(String),
        deadline: "forwarding",
        previousDeadline: "2026-12-15T16:59:59.000Z",
        newDeadline: "2026-12-20T16:59:59.000Z",
      },
    ]);
    const [entry] = await t.app.audit.search(await admin(), { action: ["round.deadline_extended"], targetId: roundId });
    expect(entry).toMatchObject({
      actorUserId: officer.userId,
      actorRole: "province_officer",
      targetType: "round",
      before: { forwardingDeadline: "2026-12-15T16:59:59.000Z" },
      after: { forwardingDeadline: "2026-12-20T16:59:59.000Z" },
      metadata: { deadline: "forwarding", reason: "Nhiều xã đề nghị thêm thời gian" },
    });
  });

  it("extends Hạn nộp xã of an open round, which stays Đang nhận nộp", async () => {
    await t.app.rounds.extendDeadline(officer, { roundId, deadline: "submission", newDate: "2026-12-05", reason: "Lũ lụt" });
    expect(await round(roundId)).toMatchObject({ status: "open_for_submission", submissionDeadline: new Date("2026-12-05T16:59:59Z") });
  });

  it("lists the history newest first", async () => {
    const history = await t.app.rounds.listDeadlineExtensions(officer, { roundId });
    expect(history.map((h) => h.deadline)).toEqual(["submission", "forwarding"]);
  });

  it.each([
    ["the same day", { deadline: "forwarding", newDate: "2026-12-20" }],
    ["an earlier day", { deadline: "submission", newDate: "2026-12-01" }],
  ])("refuses to shorten or keep a deadline: %s", async (_label, over) => {
    await expect(t.app.rounds.extendDeadline(officer, { roundId, reason: "Thử", ...over } as never)).rejects.toMatchObject({
      code: "deadline_not_later",
    });
  });

  it.each([
    ["Hạn nộp xã after Hạn gửi tỉnh", { deadline: "submission", newDate: "2026-12-21" }],
    ["Hạn gửi tỉnh after Hạn đánh giá tỉnh", { deadline: "forwarding", newDate: "2027-02-01" }],
  ])("keeps the three deadlines in order: %s", async (_label, over) => {
    await expect(t.app.rounds.extendDeadline(officer, { roundId, reason: "Thử", ...over } as never)).rejects.toMatchObject({
      code: "deadline_order",
    });
  });

  it("extends Hạn đánh giá tỉnh too, so Hạn gửi tỉnh can then move past its old value", async () => {
    const { extensionId } = await t.app.rounds.extendDeadline(officer, { roundId, deadline: "evaluation", newDate: "2027-02-28", reason: "Hội đồng họp muộn" });
    await t.app.rounds.extendDeadline(officer, { roundId, deadline: "forwarding", newDate: "2027-02-10", reason: "Xã gửi muộn" });
    expect(await round(roundId)).toMatchObject({
      forwardingDeadline: new Date("2027-02-10T16:59:59Z"),
      evaluationDeadline: new Date("2027-02-28T16:59:59Z"),
    });
    expect((await t.app.rounds.listDeadlineExtensions(officer, { roundId }))[1]).toMatchObject({
      id: extensionId,
      deadline: "evaluation",
      previousDeadline: new Date("2027-01-31T16:59:59Z"),
      newDeadline: new Date("2027-02-28T16:59:59Z"),
      reason: "Hội đồng họp muộn",
    });
    const [entry] = await t.app.audit.search(await admin(), { action: ["round.deadline_extended"], targetId: roundId });
    expect(entry).toMatchObject({ after: { forwardingDeadline: "2027-02-10T16:59:59.000Z" } });
    await expect(t.app.rounds.extendDeadline(officer, { roundId, deadline: "evaluation", newDate: "2027-02-27", reason: "Thử" })).rejects.toMatchObject({
      code: "deadline_not_later",
    });
    await expect(t.app.rounds.extendDeadline(officer, { roundId, deadline: "evaluation", newDate: "2027-03-01", reason: " " })).rejects.toMatchObject({
      code: "reason_required",
    });
  });

  it("requires a reason", async () => {
    await expect(t.app.rounds.extendDeadline(officer, { roundId, deadline: "forwarding", newDate: "2026-12-25", reason: "   " })).rejects.toMatchObject({
      code: "reason_required",
    });
  });

  it("refuses an unknown deadline and a bad date", async () => {
    await expect(t.app.rounds.extendDeadline(officer, { roundId, deadline: "decision" as never, newDate: "2027-03-10", reason: "Thử" })).rejects.toMatchObject({
      code: "invalid_deadline",
    });
    await expect(t.app.rounds.extendDeadline(officer, { roundId, deadline: "forwarding", newDate: "2026-02-30", reason: "Thử" })).rejects.toMatchObject({
      code: "invalid_date",
    });
  });

  it("lets only Cán bộ Sở extend; Quản trị is refused", async () => {
    await expect(t.app.rounds.extendDeadline(await admin(), { roundId, deadline: "forwarding", newDate: "2026-12-25", reason: "Thử" })).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("refuses a Nháp round (edit it directly) and an unknown round", async () => {
    const { roundId: draft } = await t.app.rounds.createRound(officer, roundInput({ name: "Đợt nháp" }));
    await expect(t.app.rounds.extendDeadline(officer, { roundId: draft, deadline: "forwarding", newDate: "2026-12-25", reason: "Thử" })).rejects.toMatchObject({
      code: "round_is_draft",
    });
    await expect(
      t.app.rounds.extendDeadline(officer, { roundId: "00000000-0000-7000-8000-000000000000", deadline: "forwarding", newDate: "2026-12-25", reason: "Thử" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("refuses an Đã kết thúc round", async () => {
    // A round Đã kết thúc is final in the database (0015), so this one goes straight there from Nháp by SQL;
    // the round open in this describe keeps another from being opened and ended through the use cases.
    const { roundId: ended } = await t.app.rounds.createRound(officer, roundInput({ name: "Đợt đã kết thúc" }));
    await db.admin.query(
      "UPDATE round.round SET status = 'ended', opened_at = now(), opened_by = $2, submission_closed_at = now(), ended_at = now(), ended_by = $2 WHERE id = $1",
      [ended, officer.userId],
    );
    await expect(t.app.rounds.extendDeadline(officer, { roundId: ended, deadline: "forwarding", newDate: "2026-12-25", reason: "Thử" })).rejects.toMatchObject({
      code: "round_ended",
    });
  });
});

describe("L07 gia hạn đợt Đã đóng nộp: chỉ Hạn gửi tỉnh và Hạn đánh giá tỉnh, đợt không mở lại", () => {
  let roundId: string;
  beforeAll(async () => {
    // The previous describe left its round open; close it so this one may open.
    t.clock.set(new Date("2026-12-06T00:00:00Z"));
    await t.app.rounds.closeDueSubmissions(JOB);
    t.clock.set(new Date("2026-12-06T01:00:00Z"));
    ({ roundId } = await t.app.rounds.createRound(
      officer,
      roundInput({ name: "Đợt đã đóng nộp", submissionDeadline: "2026-12-10", forwardingDeadline: "2027-01-10" }),
    ));
    await t.app.rounds.openRound(officer, { roundId });
    t.clock.set(new Date("2026-12-11T00:00:00Z"));
    await t.app.rounds.closeDueSubmissions(JOB);
  });

  it("extends Hạn gửi tỉnh of a closed round, which stays Đã đóng nộp", async () => {
    await t.app.rounds.extendDeadline(officer, { roundId, deadline: "forwarding", newDate: "2027-01-12", reason: "Chờ xã bổ sung" });
    expect(await round(roundId)).toMatchObject({ status: "submission_closed", forwardingDeadline: new Date("2027-01-12T16:59:59Z") });
  });

  it("extends Hạn đánh giá tỉnh of a closed round, which stays Đã đóng nộp", async () => {
    await t.app.rounds.extendDeadline(officer, { roundId, deadline: "evaluation", newDate: "2027-02-15", reason: "Hội đồng họp muộn" });
    expect(await round(roundId)).toMatchObject({ status: "submission_closed", evaluationDeadline: new Date("2027-02-15T16:59:59Z") });
  });

  it("refuses to extend Hạn nộp xã once submission has closed, and keeps no history of the refusal", async () => {
    const before = await t.app.rounds.listDeadlineExtensions(officer, { roundId });
    await expect(t.app.rounds.extendDeadline(officer, { roundId, deadline: "submission", newDate: "2026-12-20", reason: "Mưa bão" })).rejects.toMatchObject({
      code: "submission_closed",
    });
    expect(await t.app.rounds.listDeadlineExtensions(officer, { roundId })).toEqual(before);
    expect(await round(roundId)).toMatchObject({ status: "submission_closed", submissionDeadline: new Date("2026-12-10T16:59:59Z") });
  });

  it("refuses to extend Hạn nộp xã of a round still marked open but past it, before the job has closed it", async () => {
    const { roundId: late } = await t.app.rounds.createRound(
      officer,
      roundInput({ name: "Đợt chưa kịp đóng", submissionDeadline: "2026-12-20", forwardingDeadline: "2027-01-20" }),
    );
    await t.app.rounds.openRound(officer, { roundId: late });
    t.clock.set(new Date("2026-12-20T17:00:10Z")); // just past Hạn nộp xã; the job has not run yet
    await expect(t.app.rounds.extendDeadline(officer, { roundId: late, deadline: "submission", newDate: "2026-12-25", reason: "Muộn" })).rejects.toMatchObject({
      code: "submission_closed",
    });
    expect((await round(late)).submissionDeadline).toEqual(new Date("2026-12-20T16:59:59Z"));
  });
});

describe("L07 lịch sử gia hạn trong cơ sở dữ liệu", () => {
  it("has no reopened flag, since a round never goes back to Đang nhận nộp", async () => {
    const { rows } = await db.admin.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'round' AND table_name = 'deadline_extension' AND column_name = 'reopened'",
    );
    expect(rows).toEqual([]);
  });

  it("refuses to move a Đã đóng nộp round back to Đang nhận nộp, even for the owner", async () => {
    const { rows } = await db.admin.query("SELECT id FROM round.round WHERE status = 'submission_closed' LIMIT 1");
    for (const pool of [db.app, db.admin]) {
      await expect(pool.query("UPDATE round.round SET status = 'open_for_submission' WHERE id = $1", [rows[0].id])).rejects.toThrow(/never reopens/);
    }
  });

  it("is append-only for the app user", async () => {
    await expect(db.app.query("UPDATE round.deadline_extension SET reason = 'sửa'")).rejects.toThrow(/permission denied/);
    await expect(db.app.query("DELETE FROM round.deadline_extension")).rejects.toThrow(/permission denied/);
  });

  it("refuses a history row that shortens a deadline or has no reason", async () => {
    const [ext] = (await db.admin.query("SELECT * FROM round.deadline_extension LIMIT 1")).rows;
    const insert = (over: { prev?: string; next?: string; reason?: string }) =>
      db.app.query(
        `INSERT INTO round.deadline_extension (id, round_id, deadline, previous_deadline, new_deadline, reason, extended_by, extended_at)
         VALUES (gen_random_uuid(), $1, 'forwarding', $2, $3, $4, $5, now())`,
        [ext.round_id, over.prev ?? "2027-01-02T00:00:00Z", over.next ?? "2027-01-01T00:00:00Z", over.reason ?? "Thử", ext.extended_by],
      );
    await expect(insert({})).rejects.toThrow(/extends_later/);
    await expect(insert({ next: "2027-01-03T00:00:00Z", reason: " " })).rejects.toThrow(/reason/);
  });
});
