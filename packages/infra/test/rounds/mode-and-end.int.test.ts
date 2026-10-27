import { vnDateOf, type RoundActivity } from "@ocop/core";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { anonymous, createTestApp, createTestDatabase, hours, systemActor, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const PASSWORD = "mat-khau-can-bo-1";
let published: string;

/**
 * Stands in for the two placeholder ports (#27): phiếu chấm and hồ sơ do not exist until step 4, so the
 * tests set what the round's activity looks like.
 */
const activity = { scoreSheets: false, unfinished: 0 };
const fakeActivity: RoundActivity = {
  hasScoreSheets: async () => activity.scoreSheets,
  unfinishedDossierCount: async () => activity.unfinished,
};

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false, roundActivity: fakeActivity });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  published = await importPublished();
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});
afterEach(() => {
  activity.scoreSheets = false;
  activity.unfinished = 0;
});

const admin = () => t.signInAs(ADMIN.email, ADMIN.password);

let staffCount = 0;
/** A staff user holding one Vai trò, created through the real activation flow. */
async function staff(role: "province_officer" | "admin" = "province_officer") {
  const email = `can-bo-${++staffCount}@tinh.gov.vn`;
  const a = await admin();
  const { userId } = await t.app.identity.createStaffUser(a, { email, fullName: "Cán Bộ Sở" });
  await t.drainJobs();
  const token = /kich-hoat\?token=([\w-]+)/.exec(t.mailbox.to(email).at(-1)!.text)![1]!;
  await t.app.identity.activateAccount(anonymous(), { token, password: PASSWORD });
  await t.app.identity.grantRole(a, { userId, role, scopeId: null });
  return t.signInAs(email, PASSWORD);
}

/** A one-set Phiên bản tiêu chí that passes the check, imported and published. */
async function importPublished() {
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
  const a = await admin();
  const { versionId } = await t.app.criteria.importVersion(a, { fileName: "thu.json", content });
  await t.app.criteria.publishVersion(a, { versionId });
  return versionId;
}

const AGGREGATION = { method: "mean" as const, minGraders: 5, deviationFlagPoints: 15 };

/** A Nháp round whose Hạn nộp xã is today (Vietnam time), so the auto-close reaches it once the clock moves a day. */
async function draftRound(officer: Awaited<ReturnType<typeof staff>>) {
  const { roundId } = await t.app.rounds.createRound(officer, {
    name: "Đợt đánh giá năm 2026",
    year: 2026,
    submissionDeadline: vnDateOf(t.clock.now()),
    forwardingDeadline: "2030-12-15",
    evaluationDeadline: "2030-12-31",
    criteriaVersionId: published,
    gradingMode: "direct",
    aggregation: AGGREGATION,
  });
  return roundId;
}

/**
 * A round Đang nhận nộp. Only one round may be open at a time, so any round a previous test left open is
 * closed first by the real auto-close (#25).
 */
async function openRound(officer: Awaited<ReturnType<typeof staff>>) {
  await closeOpenRounds();
  const roundId = await draftRound(officer);
  await t.app.rounds.openRound(officer, { roundId });
  return roundId;
}

/** Moves past today's Hạn nộp xã and runs the auto-close job (L07, #25). */
async function closeOpenRounds() {
  t.clock.advance(hours(24));
  await t.app.rounds.closeDueSubmissions(systemActor("rounds.close-due"));
}

/** A round Đã đóng nộp, closed by the auto-close job. */
async function closedRound(officer: Awaited<ReturnType<typeof staff>>) {
  const roundId = await openRound(officer);
  await closeOpenRounds();
  return roundId;
}

/** A round Đã kết thúc, through the real end step. */
async function endedRound(officer: Awaited<ReturnType<typeof staff>>) {
  const roundId = await closedRound(officer);
  await t.app.rounds.endRound(officer, { roundId });
  return roundId;
}

describe("L07 HD-06 đổi Chế độ chấm", () => {
  it("changes the Chế độ chấm of a round Đang nhận nộp", async () => {
    const officer = await staff();
    const roundId = await openRound(officer);
    await t.app.rounds.changeGradingMode(officer, { roundId, gradingMode: "advisory_based" });
    expect(await t.app.rounds.getRound(officer, { roundId })).toMatchObject({ gradingMode: "advisory_based", status: "open_for_submission" });
  });

  it("changes it while the round is Đã đóng nộp", async () => {
    const officer = await staff();
    const roundId = await closedRound(officer);
    await t.app.rounds.changeGradingMode(officer, { roundId, gradingMode: "advisory_based" });
    expect(await t.app.rounds.getRound(officer, { roundId })).toMatchObject({ gradingMode: "advisory_based", status: "submission_closed" });
  });

  it("refuses once the round has its first phiếu chấm, and keeps the old Chế độ chấm", async () => {
    const officer = await staff();
    const roundId = await openRound(officer);
    activity.scoreSheets = true;
    await expect(t.app.rounds.changeGradingMode(officer, { roundId, gradingMode: "advisory_based" })).rejects.toMatchObject({
      code: "round_has_score_sheets",
    });
    expect(await t.app.rounds.getRound(officer, { roundId })).toMatchObject({ gradingMode: "direct" });
  });

  it("tells the round page whether the grading config is locked by a phiếu chấm", async () => {
    const officer = await staff();
    const roundId = await openRound(officer);
    expect(await t.app.rounds.getRound(officer, { roundId })).toMatchObject({ gradingConfigLocked: false });
    activity.scoreSheets = true;
    expect(await t.app.rounds.getRound(officer, { roundId })).toMatchObject({ gradingConfigLocked: true });
  });

  it("refuses a Nháp round (edited as a whole) and a round Đã kết thúc", async () => {
    const officer = await staff();
    const draft = await draftRound(officer);
    const ended = await endedRound(officer);
    for (const roundId of [draft, ended]) {
      await expect(t.app.rounds.changeGradingMode(officer, { roundId, gradingMode: "advisory_based" })).rejects.toMatchObject({
        code: "round_not_configurable",
      });
    }
  });

  it("emits round.grading_mode_changed and audits the change", async () => {
    const officer = await staff();
    const roundId = await openRound(officer);
    await t.app.rounds.changeGradingMode(officer, { roundId, gradingMode: "advisory_based" });
    const { rows } = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'round.grading_mode_changed' AND payload->>'roundId' = $1", [
      roundId,
    ]);
    expect(rows.map((r) => r.payload)).toEqual([{ roundId, from: "direct", to: "advisory_based" }]);
    const [entry] = await t.app.audit.search(await admin(), { action: ["round.grading_mode_changed"], targetId: roundId });
    expect(entry).toMatchObject({
      actorUserId: officer.userId,
      actorRole: "province_officer",
      before: { gradingMode: "direct" },
      after: { gradingMode: "advisory_based" },
    });
  });

  it("writes nothing when the Chế độ chấm stays the same", async () => {
    const officer = await staff();
    const roundId = await openRound(officer);
    await t.app.rounds.changeGradingMode(officer, { roundId, gradingMode: "direct" });
    const { rows } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'round.grading_mode_changed' AND payload->>'roundId' = $1", [roundId]);
    expect(rows).toHaveLength(0);
  });

  it("lets only Cán bộ Sở change it; Quản trị is refused", async () => {
    const roundId = await openRound(await staff());
    await expect(t.app.rounds.changeGradingMode(await admin(), { roundId, gradingMode: "advisory_based" })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("L07 HD-06 đổi Quy tắc tổng hợp", () => {
  const NEW_RULE = { method: "mean" as const, minGraders: 7, deviationFlagPoints: 12.5 };

  it("changes the Quy tắc tổng hợp, emits round.aggregation_changed and audits before and after", async () => {
    const officer = await staff();
    const roundId = await openRound(officer);
    await t.app.rounds.changeAggregationRule(officer, { roundId, aggregation: NEW_RULE });
    expect(await t.app.rounds.getRound(officer, { roundId })).toMatchObject({ aggregation: NEW_RULE });
    const { rows } = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'round.aggregation_changed' AND payload->>'roundId' = $1", [
      roundId,
    ]);
    expect(rows.map((r) => r.payload)).toEqual([{ roundId }]);
    const [entry] = await t.app.audit.search(await admin(), { action: ["round.aggregation_changed"], targetId: roundId });
    expect(entry).toMatchObject({ actorUserId: officer.userId, before: { aggregation: AGGREGATION }, after: { aggregation: NEW_RULE } });
  });

  it("writes nothing when the rule given equals the current one once normalised", async () => {
    const officer = await staff();
    const roundId = await openRound(officer);
    await t.app.rounds.changeAggregationRule(officer, { roundId, aggregation: { ...AGGREGATION, deviationFlagPoints: 14.999999999 } });
    const { rows } = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'round.aggregation_changed' AND payload->>'roundId' = $1", [
      roundId,
    ]);
    expect(rows).toEqual([]);
    expect(await t.app.audit.search(await admin(), { action: ["round.aggregation_changed"], targetId: roundId })).toEqual([]);
  });

  it("changes it while the round is Đã đóng nộp", async () => {
    const officer = await staff();
    const roundId = await closedRound(officer);
    await t.app.rounds.changeAggregationRule(officer, { roundId, aggregation: NEW_RULE });
    expect(await t.app.rounds.getRound(officer, { roundId })).toMatchObject({ aggregation: NEW_RULE });
  });

  it("is locked by the first phiếu chấm, like the Chế độ chấm", async () => {
    const officer = await staff();
    const roundId = await closedRound(officer);
    activity.scoreSheets = true;
    await expect(t.app.rounds.changeAggregationRule(officer, { roundId, aggregation: NEW_RULE })).rejects.toMatchObject({
      code: "round_has_score_sheets",
    });
    expect(await t.app.rounds.getRound(officer, { roundId })).toMatchObject({ aggregation: AGGREGATION });
  });

  it("refuses a Nháp round, a round Đã kết thúc and a broken rule", async () => {
    const officer = await staff();
    for (const roundId of [await draftRound(officer), await endedRound(officer)]) {
      await expect(t.app.rounds.changeAggregationRule(officer, { roundId, aggregation: NEW_RULE })).rejects.toMatchObject({
        code: "round_not_configurable",
      });
    }
    const roundId = await openRound(officer);
    await expect(t.app.rounds.changeAggregationRule(officer, { roundId, aggregation: { ...NEW_RULE, minGraders: 0 } })).rejects.toMatchObject({
      code: "invalid_aggregation",
    });
  });

  it("lets only Cán bộ Sở change it", async () => {
    const roundId = await openRound(await staff());
    await expect(t.app.rounds.changeAggregationRule(await admin(), { roundId, aggregation: NEW_RULE })).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("L07 SO-01 kết thúc đợt", () => {
  it("ends a round Đã đóng nộp, emits round.ended and audits it", async () => {
    const officer = await staff();
    const roundId = await closedRound(officer);
    await t.app.rounds.endRound(officer, { roundId });
    expect(await t.app.rounds.getRound(officer, { roundId })).toMatchObject({ status: "ended", endedAt: t.clock.now(), endedBy: officer.userId });
    const { rows } = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'round.ended' AND payload->>'roundId' = $1", [roundId]);
    expect(rows.map((r) => r.payload)).toEqual([{ roundId }]);
    const [entry] = await t.app.audit.search(await admin(), { action: ["round.ended"], targetId: roundId });
    expect(entry).toMatchObject({ actorUserId: officer.userId, before: { status: "submission_closed" }, after: { status: "ended" } });
  });

  it("refuses while some hồ sơ still has no result, and the round stays Đã đóng nộp", async () => {
    const officer = await staff();
    const roundId = await closedRound(officer);
    activity.unfinished = 3;
    await expect(t.app.rounds.endRound(officer, { roundId })).rejects.toMatchObject({
      code: "round_has_unfinished_dossiers",
      message: expect.stringContaining("3 hồ sơ"),
    });
    expect(await t.app.rounds.getRound(officer, { roundId })).toMatchObject({ status: "submission_closed", endedAt: null });
  });

  it("refuses a round still Nháp, Đang nhận nộp or already Đã kết thúc", async () => {
    const officer = await staff();
    for (const roundId of [await draftRound(officer), await endedRound(officer), await openRound(officer)]) {
      await expect(t.app.rounds.endRound(officer, { roundId })).rejects.toMatchObject({ code: "round_not_closed" });
    }
  });

  it("lets only Cán bộ Sở end a round", async () => {
    const roundId = await closedRound(await staff());
    await expect(t.app.rounds.endRound(await admin(), { roundId })).rejects.toMatchObject({ code: "forbidden" });
  });

  describe("the database keeps a round Đã kết thúc final", () => {
    it("refuses to update or delete it, as the app user and even as the owner", async () => {
      const roundId = await endedRound(await staff());
      for (const pool of [db.app, db.admin]) {
        await expect(pool.query("UPDATE round.round SET name = 'Đổi tên' WHERE id = $1", [roundId])).rejects.toThrow(/has ended/);
        await expect(
          pool.query("UPDATE round.round SET status = 'submission_closed', ended_at = NULL, ended_by = NULL WHERE id = $1", [roundId]),
        ).rejects.toThrow(/has ended/);
        await expect(pool.query("DELETE FROM round.round WHERE id = $1", [roundId])).rejects.toThrow(/cannot be deleted|has ended/);
      }
      expect(await t.app.rounds.getRound(await staff(), { roundId })).toMatchObject({ status: "ended", name: expect.not.stringMatching("Đổi tên") });
    });

    it("still lets the app user update a round that has not ended", async () => {
      const roundId = await closedRound(await staff());
      await expect(db.app.query("UPDATE round.round SET name = 'Đổi tên' WHERE id = $1", [roundId])).resolves.toMatchObject({ rowCount: 1 });
    });

    it("does not let the app user disable the trigger", async () => {
      await expect(db.app.query("ALTER TABLE round.round DISABLE TRIGGER round_ended_final")).rejects.toThrow(/must be owner/);
    });
  });
});
