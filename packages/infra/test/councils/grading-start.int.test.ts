import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "../dossiers/fixtures";

/*
 * L09 HD-06 Chế độ chấm and Giao chấm (#53, spec #49 stories 20 to 23, 30 to 33, 40): the Thư ký hội đồng
 * confirms or changes the Chế độ chấm of a đợt of its Hội đồng, then Giao chấm: the hồ sơ goes to Tổ tư vấn
 * thẩm định or Thành viên xem xét, its Phân công takes effect, and every thành viên chấm gets a Phiếu chấm
 * trống. From the first one on, the đợt's Chế độ chấm, Quy tắc tổng hợp and Hội đồng are fixed.
 */

let db: TestDatabase;
let t: TestApp;
let wardId: string;
let f: ReturnType<typeof fixtures>;
let setId: string;
let roundId: string;
let ward: UserActor;
let province: UserActor;
let A: Awaited<ReturnType<ReturnType<typeof fixtures>["staffedCouncil"]>>;
let B: Awaited<ReturnType<ReturnType<typeof fixtures>["staffedCouncil"]>>;
const START = new Date("2026-10-19T02:00:00Z");

/**
 * One database per describe: a đợt Đang nhận nộp created in chấm trực tiếp with 2 người chấm tối thiểu and
 * gán to Hội đồng A. Only one đợt is open at a time and its Chế độ chấm is fixed from the first Giao chấm,
 * so the two Chế độ chấm each get their own world.
 */
function world() {
  beforeAll(async () => {
    db = await createTestDatabase();
    t = createTestApp(db, { totpRequired: false });
    await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
    await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n");
    wardId = (await t.app.org.listWards())[0]!.id;
    f = fixtures(t, () => wardId);
    t.clock.set(START);
    const version = await f.publishedVersion("26/2026/QĐ-TTg");
    setId = version.sets["Rau củ quả"];
    ward = await f.staff("ward_officer", wardId);
    province = await f.staff("province_officer");
    A = await f.staffedCouncil(province, { members: 3, advisors: 2 });
    B = await f.staffedCouncil(province, { members: 2, advisors: 1 });
    roundId = await f.openRound(version.versionId, { minGraders: 2 });
    await t.app.rounds.assignCouncil(province, { roundId, councilId: A.councilId });
  });
  beforeEach(() => {
    t.clock.set(START);
  });
  afterAll(async () => {
    await t.stop();
    await db.drop();
  });
}

const received = () => f.provinceReceived(ward, province, setId);
async function drafted(members: UserActor[], advisors: UserActor[] = []) {
  const d = await received();
  const { version } = (
    await t.app.councils.editAssignments(A.secretary, {
      dossiers: [{ dossierId: d.dossierId, expectedVersion: d.version }],
      members: members.map((m) => m.userId),
      advisors: advisors.map((a) => a.userId),
    })
  ).dossiers[0]!;
  return { ...d, version };
}
const start = (actor: UserActor, ...ds: { dossierId: string; version: number }[]) =>
  t.app.councils.startGrading(actor, { dossiers: ds.map((d) => ({ dossierId: d.dossierId, expectedVersion: d.version })) });
const listed = async (actor: UserActor) => (await t.app.dossiers.list(actor)).map((d) => d.id);
const sheets = async (dossierId: string) =>
  (
    await db.admin.query(
      `SELECT a.user_id, s.state, s.attempt FROM scoring.score_sheet s JOIN council.assignment a ON a.id = s.assignment_id
        WHERE s.dossier_id = $1 ORDER BY a.user_id`,
      [dossierId],
    )
  ).rows;

describe("L09 HD-06 Giao chấm in chấm trực tiếp (stories 30, 33, 40)", () => {
  world();

  it("moves the hồ sơ to Thành viên xem xét, gives the Phân công effect and each thành viên chấm a Phiếu chấm trống", async () => {
    const d = await drafted([A.members[0]!, A.members[1]!]);
    t.clock.set(new Date("2026-10-20T03:00:00Z"));

    const result = await start(A.secretary, d);

    expect(result.dossiers).toEqual([{ dossierId: d.dossierId, version: d.version + 1, state: "member_review" }]);
    const seen = await t.app.dossiers.get(A.secretary, { dossierId: d.dossierId });
    expect(seen).toMatchObject({ state: "member_review", gradingStartedAt: new Date("2026-10-20T03:00:00Z") });
    const assignments = await t.app.councils.assignments(A.secretary, { dossierId: d.dossierId });
    expect(assignments.map((a) => a.effectiveAt)).toEqual([new Date("2026-10-20T03:00:00Z"), new Date("2026-10-20T03:00:00Z")]);
    expect(await sheets(d.dossierId)).toEqual(
      [A.members[0]!, A.members[1]!].map((m) => ({ user_id: m.userId, state: "draft", attempt: 1 })).sort((x, y) => x.user_id.localeCompare(y.user_id)),
    );
    for (const m of [A.members[0]!, A.members[1]!]) expect(await listed(m)).toContain(d.dossierId);
    expect(await listed(A.members[2]!)).not.toContain(d.dossierId);
  });

  it("is audited with the Phân công that took effect, emits dossier.grading_started, and shows the Chủ thể a milestone without names (story 137)", async () => {
    const d = await drafted([A.members[0]!, A.members[1]!]);

    await start(A.secretary, d);

    const [moved] = await t.app.audit.search(await f.admin(), { action: ["dossier.grading.start_direct"], targetId: d.dossierId });
    expect(moved).toMatchObject({ actorUserId: A.secretary.userId, actorRole: "council_secretary", before: { state: "forwarded_to_province" }, after: { state: "member_review" } });
    const [effect] = await t.app.audit.search(await f.admin(), { action: ["council.assignments.took_effect"], targetId: d.dossierId });
    expect(effect!.metadata).toMatchObject({ gradingMode: "direct", members: expect.arrayContaining([A.members[0]!.userId, A.members[1]!.userId]), advisors: [] });
    expect((effect!.metadata as { scoreSheetIds: string[] }).scoreSheetIds).toHaveLength(2);
    const outbox = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'dossier.grading_started' AND payload->>'dossierId' = $1", [d.dossierId]);
    expect(outbox.rows).toEqual([{ payload: expect.objectContaining({ from: "forwarded_to_province", to: "member_review" }) }]);

    const timeline = await t.app.dossiers.timeline(d.a, { dossierId: d.dossierId });
    const row = timeline.find((e) => e.action === "dossier.grading.start_direct");
    expect(row).toMatchObject({ fromState: "forwarded_to_province", toState: "member_review", metadata: { gradingMode: "direct" } });
    const text = JSON.stringify(timeline);
    for (const m of [A.members[0]!, A.members[1]!]) {
      expect(text).not.toContain(m.userId);
      expect(text).not.toContain(m.fullName);
    }
    expect(timeline.map((e) => e.action)).not.toContain("dossier.assignment.edit");
  });

  it("tells each thành viên chấm, in the app and by email, with a link to their list (story 40)", async () => {
    const d = await drafted([A.members[0]!, A.members[1]!]);
    await start(A.secretary, d);
    await t.drainJobs();

    for (const m of [A.members[0]!, A.members[1]!]) {
      expect((await t.app.notifications.list(m)).filter((n) => n.kind === "dossier_grading_started" && n.link === "/thanh-vien/ho-so")).not.toHaveLength(0);
      expect(t.mailbox.to(m.email).at(-1)!.text).toContain("/thanh-vien/ho-so");
    }
    expect((await t.app.notifications.list(A.members[2]!)).filter((n) => n.kind === "dossier_grading_started")).toEqual([]);
  });

  it("Giao chấm several hồ sơ at once, or none: one refused rolls the others back (story 30)", async () => {
    const one = await drafted([A.members[0]!, A.members[1]!]);
    const two = await drafted([A.members[0]!, A.members[2]!]);
    const short = await drafted([A.members[0]!]);

    await expect(start(A.secretary, one, two, short)).rejects.toMatchObject({ code: "not_enough_graders" });
    expect((await t.app.dossiers.get(A.secretary, { dossierId: one.dossierId })).state).toBe("forwarded_to_province");
    expect(await sheets(one.dossierId)).toEqual([]);

    const result = await start(A.secretary, two, one);
    expect(result.dossiers.map((d) => [d.dossierId, d.state])).toEqual([
      [two.dossierId, "member_review"],
      [one.dossierId, "member_review"],
    ]);
    await expect(t.app.councils.startGrading(A.secretary, { dossiers: [] })).rejects.toMatchObject({ code: "dossiers_required" });
  });

  it("refuses fewer thành viên chấm than the Quy tắc tổng hợp needs, or a Phân công Tổ tư vấn nháp in chấm trực tiếp (stories 31, 33)", async () => {
    const short = await drafted([A.members[0]!]);
    await expect(start(A.secretary, short)).rejects.toMatchObject({ code: "not_enough_graders" });

    const withAdvisor = await drafted([A.members[0]!, A.members[1]!], [A.advisors[0]!]);
    await expect(start(A.secretary, withAdvisor)).rejects.toMatchObject({ code: "advisory_assignment_in_direct_mode" });
    // The Thư ký removes the Thành viên Tổ tư vấn, then Giao chấm goes through.
    const { version } = (
      await t.app.councils.editAssignments(A.secretary, {
        dossiers: [{ dossierId: withAdvisor.dossierId, expectedVersion: withAdvisor.version }],
        members: [A.members[0]!.userId, A.members[1]!.userId],
        advisors: [],
      })
    ).dossiers[0]!;
    await expect(start(A.secretary, { dossierId: withAdvisor.dossierId, version })).resolves.toBeDefined();
  });

  it("refuses a thành viên chấm who no longer holds the Phân vai on the Hội đồng (story 25)", async () => {
    const leaving = await f.staff("council_member", A.councilId);
    const d = await drafted([A.members[0]!, leaving]);
    await t.app.identity.revokeRole(await f.admin(), { assignmentId: leaving.activeAssignmentId! });

    await expect(start(A.secretary, d)).rejects.toMatchObject({ code: "not_council_member" });
  });

  it("refuses a hồ sơ not Tiếp nhận tại tỉnh in the current lượt gửi tỉnh (story 32)", async () => {
    const d = await drafted([A.members[0]!, A.members[1]!]);
    let { version } = await t.app.dossiers.returnFromProvince(province, {
      dossierId: d.dossierId,
      expectedVersion: d.version,
      deadline: "2026-10-31",
      items: [{ content: "Bổ sung phiếu kiểm nghiệm" }],
    });
    await expect(start(A.secretary, { dossierId: d.dossierId, version })).rejects.toMatchObject({ code: "invalid_state" });
    ({ version } = await t.app.dossiers.submit(d.a, { dossierId: d.dossierId, expectedVersion: version }));
    const fileId = await f.uploadPdf(ward, "signed_ward_report", "BC lần 2.pdf");
    ({ version } = await t.app.dossiers.attachSignedWardReport(ward, { dossierId: d.dossierId, expectedVersion: version, fileId }));
    ({ version } = await t.app.dossiers.forwardToProvince(ward, { dossierId: d.dossierId, expectedVersion: version }));

    await expect(start(A.secretary, { dossierId: d.dossierId, version })).rejects.toMatchObject({ code: "not_province_received" });
    ({ version } = await t.app.dossiers.receiveAtProvince(province, { dossierId: d.dossierId, expectedVersion: version }));
    await expect(start(A.secretary, { dossierId: d.dossierId, version })).resolves.toBeDefined();
  });

  it("fixes the đợt's Chế độ chấm, Quy tắc tổng hợp and Hội đồng from its first Giao chấm on (stories 11, 21, 22)", async () => {
    expect((await t.app.rounds.getRound(province, { roundId })).gradingConfigLocked).toBe(true);
    for (const actor of [province, A.secretary]) {
      await expect(t.app.rounds.changeGradingMode(actor, { roundId, gradingMode: "advisory_based" })).rejects.toMatchObject({ code: "round_has_score_sheets" });
    }
    await expect(
      t.app.rounds.changeAggregationRule(province, { roundId, aggregation: { method: "mean", minGraders: 1, deviationFlagPoints: 15 } }),
    ).rejects.toMatchObject({ code: "round_has_score_sheets" });
    await expect(t.app.rounds.assignCouncil(province, { roundId, councilId: B.councilId })).rejects.toMatchObject({ code: "round_council_locked" });
  });
});

describe("L09 HD-06 Chế độ chấm by the Thư ký, and Giao chấm dựa trên Tổ tư vấn (stories 20, 23, 31, 33, 40)", () => {
  world();

  it("lets the Thư ký of the đợt's Hội đồng confirm or change its Chế độ chấm, and nobody else on a Hội đồng (stories 20, 23)", async () => {
    await expect(t.app.rounds.changeGradingMode(B.secretary, { roundId, gradingMode: "advisory_based" })).rejects.toMatchObject({ code: "forbidden" });
    for (const actor of [A.chair, A.members[0]!, A.advisors[0]!]) {
      await expect(t.app.rounds.changeGradingMode(actor, { roundId, gradingMode: "advisory_based" })).rejects.toMatchObject({ code: "forbidden" });
    }
    // Confirming the Chế độ chấm it already has changes nothing.
    await t.app.rounds.changeGradingMode(A.secretary, { roundId, gradingMode: "direct" });
    expect(await t.app.audit.search(await f.admin(), { action: ["round.grading_mode_changed"], targetId: roundId })).toEqual([]);

    await t.app.rounds.changeGradingMode(A.secretary, { roundId, gradingMode: "advisory_based" });

    expect((await t.app.rounds.getRound(A.secretary, { roundId })).gradingMode).toBe("advisory_based");
    const [entry] = await t.app.audit.search(await f.admin(), { action: ["round.grading_mode_changed"], targetId: roundId });
    expect(entry).toMatchObject({ actorUserId: A.secretary.userId, actorRole: "council_secretary", before: { gradingMode: "direct" }, after: { gradingMode: "advisory_based" } });
  });

  it("refuses Giao chấm without a Thành viên Tổ tư vấn (story 31)", async () => {
    const d = await drafted([A.members[0]!, A.members[1]!]);
    await expect(start(A.secretary, d)).rejects.toMatchObject({ code: "advisory_member_required" });
  });

  it("moves the hồ sơ to Tổ tư vấn thẩm định; the Tổ tư vấn and thành viên chấm see it and hear of it, and only thành viên chấm get a Phiếu chấm (stories 33, 40, 81)", async () => {
    const d = await drafted([A.members[0]!, A.members[1]!], [A.advisors[0]!]);

    const result = await start(A.secretary, d);

    expect(result.dossiers[0]!.state).toBe("advisory_review");
    expect(await sheets(d.dossierId)).toEqual(
      [A.members[0]!, A.members[1]!].map((m) => ({ user_id: m.userId, state: "draft", attempt: 1 })).sort((x, y) => x.user_id.localeCompare(y.user_id)),
    );
    for (const actor of [A.advisors[0]!, A.members[0]!, A.members[1]!]) expect(await listed(actor)).toContain(d.dossierId);
    expect(await listed(A.advisors[1]!)).not.toContain(d.dossierId);
    const timeline = await t.app.dossiers.timeline(d.a, { dossierId: d.dossierId });
    expect(timeline.find((e) => e.action === "dossier.grading.start_advisory")).toMatchObject({ toState: "advisory_review" });

    await t.drainJobs();
    expect((await t.app.notifications.list(A.advisors[0]!)).filter((n) => n.kind === "dossier_grading_started" && n.link === "/to-tu-van/hang-doi")).toHaveLength(1);
    expect(t.mailbox.to(A.advisors[0]!.email).at(-1)!.text).toContain("/to-tu-van/hang-doi");
    expect((await t.app.notifications.list(A.members[0]!)).filter((n) => n.kind === "dossier_grading_started" && n.link === "/thanh-vien/ho-so")).toHaveLength(1);
  });
});
