import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonymous, createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";

let db: TestDatabase;
let t: TestApp;
const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const PASSWORD = "mat-khau-can-bo-1";
let published: string;

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  published = await importDraft();
  await t.app.criteria.publishVersion(await admin(), { versionId: published });
});
afterAll(async () => {
  await t.stop();
  await db.drop();
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

describe("L07 SO-01 tạo Đợt đánh giá", () => {
  it("creates a draft round whose deadlines are the end of the day in Vietnam time", async () => {
    const officer = await staff();
    const { roundId } = await t.app.rounds.createRound(officer, roundInput());
    expect(await t.app.rounds.getRound(officer, { roundId })).toMatchObject({
      id: roundId,
      name: "Đợt đánh giá năm 2026",
      year: 2026,
      status: "draft",
      submissionDeadline: new Date("2026-11-30T16:59:59Z"),
      forwardingDeadline: new Date("2026-12-15T16:59:59Z"),
      evaluationDeadline: new Date("2027-01-31T16:59:59Z"),
      criteriaVersion: { id: published, legalBasis: "99/2027/QĐ-TTg" },
      gradingMode: "direct",
      aggregation: { method: "mean", minGraders: 5, deviationFlagPoints: 15 },
    });
  });

  it.each([
    ["Hạn nộp xã after Hạn gửi tỉnh", { submissionDeadline: "2026-12-16" }],
    ["Hạn gửi tỉnh after Hạn đánh giá tỉnh", { forwardingDeadline: "2027-02-01" }],
  ])("refuses deadlines out of order: %s", async (_label, over) => {
    await expect(t.app.rounds.createRound(await staff(), roundInput(over))).rejects.toMatchObject({ code: "deadline_order" });
  });

  it("accepts the three deadlines on the same day", async () => {
    const day = { submissionDeadline: "2026-12-01", forwardingDeadline: "2026-12-01", evaluationDeadline: "2026-12-01" };
    await expect(t.app.rounds.createRound(await staff(), roundInput(day))).resolves.toMatchObject({ roundId: expect.any(String) });
  });

  it("refuses a Phiên bản tiêu chí still in draft", async () => {
    const draft = await importDraft();
    await expect(t.app.rounds.createRound(await staff(), roundInput({ criteriaVersionId: draft }))).rejects.toMatchObject({
      code: "version_not_published",
    });
  });

  it("refuses an empty name and a broken Quy tắc tổng hợp", async () => {
    const officer = await staff();
    await expect(t.app.rounds.createRound(officer, roundInput({ name: "  " }))).rejects.toMatchObject({ code: "name_required" });
    const zeroGraders = { method: "mean", minGraders: 0, deviationFlagPoints: 15 };
    await expect(t.app.rounds.createRound(officer, roundInput({ aggregation: zeroGraders }))).rejects.toMatchObject({ code: "invalid_aggregation" });
  });

  it("lets only Cán bộ Sở write rounds; Quản trị is refused", async () => {
    const a = await admin();
    await expect(t.app.rounds.createRound(a, roundInput())).rejects.toMatchObject({ code: "forbidden" });
  });

  it("records the creation in the audit log and the outbox", async () => {
    const officer = await staff();
    const { roundId } = await t.app.rounds.createRound(officer, roundInput({ name: "Đợt có dấu vết" }));
    const [entry] = await t.app.audit.search(await admin(), { action: ["round.created"], targetId: roundId });
    expect(entry).toMatchObject({ actorUserId: officer.userId, actorRole: "province_officer", after: { name: "Đợt có dấu vết", status: "draft", criteriaVersionId: published } });
    const { rows } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'round.created' AND payload->>'roundId' = $1", [roundId]);
    expect(rows).toHaveLength(1);
  });
});

describe("L07 SO-01 sửa và xóa đợt Nháp", () => {
  it("edits every field of a Nháp round, Phiên bản tiêu chí included", async () => {
    const officer = await staff();
    const other = await importDraft();
    await t.app.criteria.publishVersion(await admin(), { versionId: other });
    const { roundId } = await t.app.rounds.createRound(officer, roundInput());
    await t.app.rounds.updateRound(officer, {
      roundId,
      ...roundInput({ name: "Đợt đã sửa", submissionDeadline: "2026-12-01", criteriaVersionId: other, gradingMode: "advisory_based" }),
    });
    expect(await t.app.rounds.getRound(officer, { roundId })).toMatchObject({
      name: "Đợt đã sửa",
      status: "draft",
      submissionDeadline: new Date("2026-12-01T16:59:59Z"),
      criteriaVersion: { id: other },
      gradingMode: "advisory_based",
    });
    const [entry] = await t.app.audit.search(await admin(), { action: ["round.updated"], targetId: roundId });
    expect(entry).toMatchObject({ before: { name: "Đợt đánh giá năm 2026" }, after: { name: "Đợt đã sửa" } });
  });

  it("deletes a Nháp round", async () => {
    const officer = await staff();
    const { roundId } = await t.app.rounds.createRound(officer, roundInput({ name: "Đợt tạo nhầm" }));
    await t.app.rounds.deleteRound(officer, { roundId });
    await expect(t.app.rounds.getRound(officer, { roundId })).rejects.toMatchObject({ code: "not_found" });
    expect((await t.app.rounds.listRounds(officer)).map((r) => r.id)).not.toContain(roundId);
    const [entry] = await t.app.audit.search(await admin(), { action: ["round.deleted"], targetId: roundId });
    expect(entry).toMatchObject({ before: { name: "Đợt tạo nhầm" } });
  });
});

describe("L07 SO-01 mở đợt", () => {
  let officer: Awaited<ReturnType<typeof staff>>;
  let opened: string;

  beforeAll(async () => {
    officer = await staff();
  });

  it("refuses to open a round whose Hạn nộp xã has passed", async () => {
    const { roundId } = await t.app.rounds.createRound(officer, roundInput({ submissionDeadline: "2026-10-18" }));
    await expect(t.app.rounds.openRound(officer, { roundId })).rejects.toMatchObject({ code: "deadline_passed" });
    expect(await t.app.rounds.getRound(officer, { roundId })).toMatchObject({ status: "draft" });
  });

  it("opens a round on the last day of Hạn nộp xã (Vietnam time)", async () => {
    const before = t.clock.now();
    const { roundId } = await t.app.rounds.createRound(officer, roundInput({ name: "Đợt chính", submissionDeadline: "2026-11-30" }));
    t.clock.set(new Date("2026-11-30T16:59:59Z")); // 23:59:59 on 30/11 in Vietnam
    await t.app.rounds.openRound(officer, { roundId });
    t.clock.set(before);
    opened = roundId;
    expect(await t.app.rounds.getRound(officer, { roundId })).toMatchObject({ status: "open_for_submission", openedBy: officer.userId });
  });

  it("emits round.opened with the Phiên bản tiêu chí and Hạn nộp xã, and audits it", async () => {
    const { rows } = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'round.opened' AND payload->>'roundId' = $1", [opened]);
    expect(rows.map((r) => r.payload)).toEqual([{ roundId: opened, criteriaVersionId: published, submissionDeadline: "2026-11-30T16:59:59.000Z" }]);
    const [entry] = await t.app.audit.search(await admin(), { action: ["round.opened"], targetId: opened });
    expect(entry).toMatchObject({ actorUserId: officer.userId, actorRole: "province_officer", before: { status: "draft" }, after: { status: "open_for_submission" } });
  });

  it("gives every signed-in Người dùng the round Đang nhận nộp (for L02)", async () => {
    expect(await t.app.rounds.currentOpenRound(await admin())).toMatchObject({ id: opened, criteriaVersion: { id: published } });
    const listed = await t.app.rounds.listRounds(await admin());
    expect(listed.find((r) => r.id === opened)).toMatchObject({ status: "open_for_submission", criteriaVersion: { legalBasis: "99/2027/QĐ-TTg" } });
  });

  it("refuses to open a second round while one is Đang nhận nộp", async () => {
    const { roundId } = await t.app.rounds.createRound(officer, roundInput({ name: "Đợt thứ hai" }));
    await expect(t.app.rounds.openRound(officer, { roundId })).rejects.toMatchObject({ code: "round_already_open" });
    expect(await t.app.rounds.getRound(officer, { roundId })).toMatchObject({ status: "draft" });
  });

  it("refuses to edit, delete or reopen an opened round, so its Phiên bản tiêu chí stays fixed", async () => {
    await expect(t.app.rounds.updateRound(officer, { roundId: opened, ...roundInput({ name: "Đổi tên" }) })).rejects.toMatchObject({
      code: "round_not_draft",
    });
    await expect(t.app.rounds.deleteRound(officer, { roundId: opened })).rejects.toMatchObject({ code: "round_not_draft" });
    await expect(t.app.rounds.openRound(officer, { roundId: opened })).rejects.toMatchObject({ code: "round_not_draft" });
  });

  it("lets only Cán bộ Sở open a round", async () => {
    const { roundId } = await t.app.rounds.createRound(officer, roundInput());
    await expect(t.app.rounds.openRound(await admin(), { roundId })).rejects.toMatchObject({ code: "forbidden" });
  });

  describe("the database holds the rules too, as the app user", () => {
    it("refuses a second round Đang nhận nộp (partial unique index)", async () => {
      const { roundId } = await t.app.rounds.createRound(officer, roundInput());
      await expect(
        db.app.query("UPDATE round.round SET status = 'open_for_submission', opened_at = now() WHERE id = $1", [roundId]),
      ).rejects.toThrow(/round_one_open/);
    });

    it("refuses to change the Phiên bản tiêu chí of an opened round", async () => {
      const other = await importDraft();
      await t.app.criteria.publishVersion(await admin(), { versionId: other });
      await expect(db.app.query("UPDATE round.round SET criteria_version_id = $2 WHERE id = $1", [opened, other])).rejects.toThrow(
        /criteria version is fixed/,
      );
    });

    it("refuses to delete an opened round and to point a round at a draft version", async () => {
      await expect(db.app.query("DELETE FROM round.round WHERE id = $1", [opened])).rejects.toThrow(/cannot be deleted/);
      const { roundId } = await t.app.rounds.createRound(officer, roundInput());
      const draft = await importDraft();
      await expect(db.app.query("UPDATE round.round SET criteria_version_id = $2 WHERE id = $1", [roundId, draft])).rejects.toThrow(
        /is not published/,
      );
    });

    it("refuses deadlines out of order", async () => {
      const { roundId } = await t.app.rounds.createRound(officer, roundInput());
      await expect(
        db.app.query("UPDATE round.round SET submission_deadline = evaluation_deadline + interval '1 day' WHERE id = $1", [roundId]),
      ).rejects.toThrow(/deadlines_ordered/);
    });

    it("does not let the app user disable the guard trigger", async () => {
      await expect(db.app.query("ALTER TABLE round.round DISABLE TRIGGER round_guard")).rejects.toThrow(/must be owner/);
    });
  });
});

describe("L07 đợt Nháp chỉ Cán bộ Sở thấy", () => {
  it("hides a Nháp round from other Vai trò: not listed, and reported as not found", async () => {
    const officer = await staff();
    const { roundId } = await t.app.rounds.createRound(officer, roundInput({ name: "Đợt còn nháp" }));
    const a = await admin();
    expect((await t.app.rounds.listRounds(a)).map((r) => r.id)).not.toContain(roundId);
    await expect(t.app.rounds.getRound(a, { roundId })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.rounds.listDeadlineExtensions(a, { roundId })).rejects.toMatchObject({ code: "not_found" });
    expect((await t.app.rounds.listRounds(officer)).map((r) => r.id)).toContain(roundId);
    await expect(t.app.rounds.getRound(officer, { roundId })).resolves.toMatchObject({ status: "draft" });
  });
});

describe("L07 SO-01 mở đợt khi đợt đang mở đã quá Hạn nộp xã", () => {
  it("closes the overdue round first, as the auto-close job would, then opens the new one", async () => {
    const officer = await staff();
    const overdue = (await t.app.rounds.currentOpenRound(officer))!; // left open by "mở đợt", Hạn nộp xã 30/11/2026
    expect(overdue.submissionDeadline).toEqual(new Date("2026-11-30T16:59:59Z"));
    const before = t.clock.now();
    t.clock.set(new Date("2026-11-30T17:00:30Z")); // past Hạn nộp xã; the job has not run yet
    try {
      const { roundId } = await t.app.rounds.createRound(officer, roundInput({ name: "Đợt kế tiếp", submissionDeadline: "2026-12-10" }));
      await t.app.rounds.openRound(officer, { roundId });

      expect(await t.app.rounds.getRound(officer, { roundId: overdue.id })).toMatchObject({
        status: "submission_closed",
        submissionClosedAt: new Date("2026-11-30T17:00:30Z"),
      });
      expect(await t.app.rounds.currentOpenRound(officer)).toMatchObject({ id: roundId });
      const { rows } = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'round.submission_closed' AND payload->>'roundId' = $1", [
        overdue.id,
      ]);
      expect(rows.map((r) => r.payload)).toEqual([
        { roundId: overdue.id, submissionDeadline: "2026-11-30T16:59:59.000Z", closedAt: "2026-11-30T17:00:30.000Z" },
      ]);
      const [entry] = await t.app.audit.search(await admin(), { action: ["round.submission_closed"], targetId: overdue.id });
      expect(entry).toMatchObject({ actorUserId: null, actorRole: "system:rounds.close-due", after: { status: "submission_closed" } });
      expect(await t.app.rounds.closeDueSubmissions(systemActor("rounds.close-due"))).toEqual({ closed: [] });
    } finally {
      t.clock.set(before);
    }
  });
});
