import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBoss } from "../../src/jobs/boss";
import { startWorkers } from "../../src/jobs/worker";
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
  forwardingDeadline: "2027-01-15",
  evaluationDeadline: "2027-01-31",
  criteriaVersionId: published,
  gradingMode: "direct" as const,
  aggregation: { method: "mean" as const, minGraders: 5, deviationFlagPoints: 15 },
  ...over,
});

const statusOf = async (roundId: string) => (await t.app.rounds.getRound(officer, { roundId })).status;
const closedEvents = async (roundId: string) =>
  (await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'round.submission_closed' AND payload->>'roundId' = $1", [roundId])).rows;

describe("L07 tự đóng nhận nộp khi qua Hạn nộp xã", () => {
  let first: string;
  let late: string;

  beforeAll(async () => {
    ({ roundId: first } = await t.app.rounds.createRound(officer, roundInput({ name: "Đợt 1" })));
    await t.app.rounds.openRound(officer, { roundId: first });
    // A Nháp round whose Hạn nộp xã passes too: auto-close leaves it alone.
    ({ roundId: late } = await t.app.rounds.createRound(officer, roundInput({ name: "Đợt nháp" })));
  });

  it("leaves a round Đang nhận nộp before Hạn nộp xã, including its last second", async () => {
    expect(await t.app.rounds.closeDueSubmissions(JOB)).toEqual({ closed: [] });
    t.clock.set(new Date("2026-11-30T16:59:59Z")); // 23:59:59 on 30/11 in Vietnam
    expect(await t.app.rounds.closeDueSubmissions(JOB)).toEqual({ closed: [] });
    expect(await statusOf(first)).toBe("open_for_submission");
    expect(await closedEvents(first)).toEqual([]);
  });

  it("closes the round once Hạn nộp xã has passed and emits round.submission_closed", async () => {
    t.clock.set(new Date("2026-11-30T17:00:00Z"));
    expect(await t.app.rounds.closeDueSubmissions(JOB)).toEqual({ closed: [first] });
    expect(await t.app.rounds.getRound(officer, { roundId: first })).toMatchObject({
      status: "submission_closed",
      submissionClosedAt: new Date("2026-11-30T17:00:00Z"),
    });
    expect((await closedEvents(first)).map((r) => r.payload)).toEqual([
      { roundId: first, submissionDeadline: "2026-11-30T16:59:59.000Z", closedAt: "2026-11-30T17:00:00.000Z" },
    ]);
    expect(await statusOf(late)).toBe("draft");
  });

  it("records the closing in the audit log under the system actor", async () => {
    const entries = await t.app.audit.search(await admin(), { action: ["round.submission_closed"], targetId: first });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actorUserId: null,
      actorRole: "system:rounds.close-due",
      targetType: "round",
      before: { status: "open_for_submission" },
      after: { status: "submission_closed", submissionClosedAt: "2026-11-30T17:00:00.000Z" },
    });
  });

  it("is idempotent: a second run changes nothing and emits nothing", async () => {
    t.clock.advance(60_000);
    expect(await t.app.rounds.closeDueSubmissions(JOB)).toEqual({ closed: [] });
    expect(await closedEvents(first)).toHaveLength(1);
    expect(await t.app.audit.search(await admin(), { action: ["round.submission_closed"], targetId: first })).toHaveLength(1);
    expect(await t.app.rounds.getRound(officer, { roundId: first })).toMatchObject({ submissionClosedAt: new Date("2026-11-30T17:00:00Z") });
  });

  it("lets Cán bộ Sở open a new round while the old one stays Đã đóng nộp, and both can be closed", async () => {
    const { roundId: second } = await t.app.rounds.createRound(officer, roundInput({ name: "Đợt 2", submissionDeadline: "2026-12-20" }));
    await t.app.rounds.openRound(officer, { roundId: second });
    expect(await statusOf(second)).toBe("open_for_submission");
    expect(await statusOf(first)).toBe("submission_closed");

    t.clock.set(new Date("2026-12-21T00:00:00Z"));
    expect(await t.app.rounds.closeDueSubmissions(JOB)).toEqual({ closed: [second] });
    expect(await statusOf(first)).toBe("submission_closed");
    expect(await statusOf(second)).toBe("submission_closed");
    expect(await statusOf(late)).toBe("draft");
  });

  it("runs as the worker job rounds.close-due, scheduled every minute in Vietnam time", async () => {
    const { roundId: third } = await t.app.rounds.createRound(officer, roundInput({ name: "Đợt 3", submissionDeadline: "2027-01-10" }));
    await t.app.rounds.openRound(officer, { roundId: third });
    t.clock.set(new Date("2027-01-11T00:00:00Z"));

    const boss = createBoss(db.url("app"), { supervise: false, schedule: false });
    await boss.start();
    const stop = await startWorkers(t.app, db.app, boss, { relayIntervalMs: 60_000 });
    try {
      expect(await boss.getSchedules("rounds.close-due")).toMatchObject([{ name: "rounds.close-due", cron: "* * * * *", options: { tz: "Asia/Ho_Chi_Minh" } }]);
      await boss.send("rounds.close-due", null);
      await expect.poll(() => statusOf(third), { timeout: 10_000 }).toBe("submission_closed");
      const [entry] = await t.app.audit.search(await admin(), { action: ["round.submission_closed"], targetId: third });
      expect(entry).toMatchObject({ actorRole: "system:rounds.close-due" });
    } finally {
      stop();
      await boss.stop({ graceful: false });
    }
  });
});
