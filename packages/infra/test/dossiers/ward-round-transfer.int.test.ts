import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "./fixtures";

let db: TestDatabase;
let t: TestApp;
let wardId: string;
let otherWardId: string;
let f: ReturnType<typeof fixtures>;
let officer: UserActor;
let provinceOfficer: UserActor;

/** The round every hồ sơ is submitted into: Hạn nộp xã 30/11/2026, Hạn gửi tỉnh 15/12/2026. */
let firstRound: string;
/** Same Phiên bản tiêu chí, Đang nhận nộp, Hạn gửi tỉnh 31/01/2027: where a hồ sơ may go. */
let nextRound: string;
let otherVersionRound: string;
let endedRound: string;
let pastForwardingRound: string;
let draftRound: string;

/** A received hồ sơ, a not-yet-received one, a Không đạt sơ bộ one, and one of another xã. */
let received: { dossierId: string; version: number; owner: UserActor };
let unreceived: { dossierId: string; version: number };
let rejected: { dossierId: string };
let elsewhere: { dossierId: string; version: number };

/** Still 15/12/2026 in Vietnam (23:00): the Hạn gửi tỉnh of the first round has not passed. */
const LAST_FORWARDING_HOUR = new Date("2026-12-15T16:00:00Z");
/** 16/12/2026 09:00 in Vietnam: past the Hạn gửi tỉnh of the first round. */
const AFTER_FORWARDING = new Date("2026-12-16T02:00:00Z");
const CLOSE = systemActor("rounds.close-due");

async function round(criteriaVersionId: string, d: { submission: string; forwarding: string; evaluation: string }, open = true) {
  const { roundId } = await t.app.rounds.createRound(provinceOfficer, {
    name: `Đợt ${d.submission}`,
    year: 2026,
    submissionDeadline: d.submission,
    forwardingDeadline: d.forwarding,
    evaluationDeadline: d.evaluation,
    criteriaVersionId,
    gradingMode: "direct",
    aggregation: { method: "mean", minGraders: 5, deviationFlagPoints: 15 },
  });
  if (open) await t.app.rounds.openRound(provinceOfficer, { roundId });
  return roundId;
}

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n00002,Xã Bình Lợi\n");
  const wards = await t.app.org.listWards();
  wardId = wards.find((w) => w.name === "Xã An Phú")!.id;
  otherWardId = wards.find((w) => w.name === "Xã Bình Lợi")!.id;
  f = fixtures(t, () => wardId);
  officer = await f.staff("ward_officer", wardId);
  provinceOfficer = await f.staff("province_officer");

  const v1 = await f.publishedVersion("26/2026/QĐ-TTg");
  const v2 = await f.publishedVersion("27/2026/QĐ-TTg");
  firstRound = await f.openRound(v1.versionId);

  const s = await f.submitted(v1.sets["Rau củ quả"]);
  const r = await t.app.dossiers.receive(officer, { dossierId: s.dossierId, expectedVersion: s.version });
  received = { dossierId: s.dossierId, version: r.version, owner: s.a };
  unreceived = await f.submitted(v1.sets["Thịt tươi"]);
  const toReject = await f.received(officer, v1.sets["Rau củ quả"]);
  await t.app.dossiers.reject(officer, { dossierId: toReject.dossierId, expectedVersion: toReject.version, reasonCode: "other", explanation: "Không phù hợp" });
  rejected = toReject;
  elsewhere = await f.submitted(v1.sets["Rau củ quả"], otherWardId);

  // The đợt that follow, one open at a time.
  t.clock.set(new Date("2026-12-01T02:00:00Z"));
  await t.app.rounds.closeDueSubmissions(CLOSE);
  pastForwardingRound = await round(v1.versionId, { submission: "2026-12-02", forwarding: "2026-12-10", evaluation: "2026-12-20" });
  t.clock.set(new Date("2026-12-03T02:00:00Z"));
  await t.app.rounds.closeDueSubmissions(CLOSE);
  endedRound = await round(v1.versionId, { submission: "2026-12-04", forwarding: "2027-01-31", evaluation: "2027-02-28" });
  t.clock.set(new Date("2026-12-05T02:00:00Z"));
  await t.app.rounds.closeDueSubmissions(CLOSE);
  await t.app.rounds.endRound(provinceOfficer, { roundId: endedRound });
  otherVersionRound = await round(v2.versionId, { submission: "2026-12-06", forwarding: "2027-01-31", evaluation: "2027-02-28" });
  t.clock.set(new Date("2026-12-07T02:00:00Z"));
  await t.app.rounds.closeDueSubmissions(CLOSE);
  draftRound = await round(v1.versionId, { submission: "2027-01-10", forwarding: "2027-01-31", evaluation: "2027-02-28" }, false);
  nextRound = await round(v1.versionId, { submission: "2027-01-15", forwarding: "2027-01-31", evaluation: "2027-02-28" });
});
beforeEach(() => {
  t.clock.set(AFTER_FORWARDING);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("L06 XA-08 Chờ đợt sau (story 68)", () => {
  it("labels a hồ sơ Đã nộp xã once the Hạn gửi tỉnh of its đợt has passed, not before", async () => {
    t.clock.set(LAST_FORWARDING_HOUR);
    expect((await t.app.dossiers.get(officer, { dossierId: received.dossierId })).awaitingNextRound).toBe(false);

    t.clock.set(AFTER_FORWARDING);
    const view = await t.app.dossiers.get(officer, { dossierId: received.dossierId });
    expect(view).toMatchObject({ state: "submitted_to_ward", roundId: firstRound, awaitingNextRound: true });
    expect((await t.app.dossiers.get(officer, { dossierId: rejected.dossierId })).awaitingNextRound).toBe(false);
  });

  it("filters the list of the xã to the hồ sơ Chờ đợt sau, still Đã nộp xã and of its own xã only", async () => {
    t.clock.set(LAST_FORWARDING_HOUR);
    expect(await t.app.dossiers.list(officer, { filter: "awaiting_next_round" })).toEqual([]);

    t.clock.set(AFTER_FORWARDING);
    const listed = await t.app.dossiers.list(officer, { filter: "awaiting_next_round" });
    expect(listed.map((d) => d.id).sort()).toEqual([received.dossierId, unreceived.dossierId].sort());
    expect(listed.every((d) => d.awaitingNextRound)).toBe(true);
  });
});

describe("L06 XA-08 chuyển đợt (stories 69, 70)", () => {
  const transfer = (actor: UserActor, d: { dossierId: string; version: number }, roundId: string, reason = "Quá Hạn gửi tỉnh, xét ở đợt sau") =>
    t.app.dossiers.transferRound(actor, { dossierId: d.dossierId, expectedVersion: d.version, roundId, reason });

  it.each([
    ["a different Phiên bản tiêu chí", () => otherVersionRound, "round_criteria_version_mismatch"],
    ["an ended đợt", () => endedRound, "round_ended"],
    ["a đợt past its Hạn gửi tỉnh", () => pastForwardingRound, "round_forwarding_deadline_passed"],
    ["a đợt still Nháp, whose Phiên bản tiêu chí may yet change", () => draftRound, "round_not_open"],
    ["the đợt it is already in", () => firstRound, "same_round"],
  ])("refuses to move a hồ sơ to %s", async (_label, target, code) => {
    await expect(transfer(officer, unreceived, target())).rejects.toMatchObject({ code });
    expect((await t.app.dossiers.get(officer, { dossierId: unreceived.dossierId })).roundId).toBe(firstRound);
  });

  it("refuses without a lý do, or to a đợt that does not exist", async () => {
    await expect(transfer(officer, unreceived, nextRound, "  ")).rejects.toMatchObject({ code: "reason_required" });
    await expect(transfer(officer, unreceived, "not-a-uuid")).rejects.toMatchObject({ code: "invalid_round" });
  });

  it("refuses a hồ sơ that is not Đã nộp xã, one of another xã, and any Vai trò other than Cán bộ xã", async () => {
    const view = await t.app.dossiers.get(officer, { dossierId: rejected.dossierId });
    await expect(transfer(officer, { dossierId: rejected.dossierId, version: view.version }, nextRound)).rejects.toMatchObject({ code: "invalid_state" });
    await expect(transfer(officer, elsewhere, nextRound)).rejects.toMatchObject({ code: "not_found" });
    await expect(transfer(received.owner, received, nextRound)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("offers the Cán bộ xã only the đợt that may take the hồ sơ, and the Chủ thể none", async () => {
    expect((await t.app.dossiers.roundTransferTargets(officer, { dossierId: unreceived.dossierId })).map((r) => r.id)).toEqual([nextRound]);
    expect(await t.app.dossiers.roundTransferTargets(received.owner, { dossierId: received.dossierId })).toEqual([]);
  });

  it("refuses a stale version", async () => {
    await expect(transfer(officer, { ...unreceived, version: unreceived.version - 1 }, nextRound)).rejects.toMatchObject({ code: "version_conflict" });
  });

  it("moves a hồ sơ Chờ đợt sau to the next đợt without changing its state, on the timeline, audit and outbox, and tells the Chủ thể", async () => {
    const { version } = await transfer(officer, received, nextRound);

    const view = await t.app.dossiers.get(officer, { dossierId: received.dossierId });
    expect(view).toMatchObject({ state: "submitted_to_ward", roundId: nextRound, version, awaitingNextRound: false, handler: { userId: officer.userId } });
    expect(view.receivedAt).not.toBeNull();
    const event = (await t.app.dossiers.timeline(received.owner, { dossierId: received.dossierId })).at(-1)!;
    expect(event).toMatchObject({
      action: "dossier.round_transfer",
      fromState: "submitted_to_ward",
      toState: "submitted_to_ward",
      reason: "Quá Hạn gửi tỉnh, xét ở đợt sau",
      metadata: { fromRoundId: firstRound, toRoundId: nextRound },
    });
    const [audit] = await t.app.audit.search(await f.admin(), { action: ["dossier.round_transfer"], targetId: received.dossierId });
    expect(audit).toMatchObject({ actorUserId: officer.userId, actorRole: "ward_officer", metadata: { reason: "Quá Hạn gửi tỉnh, xét ở đợt sau" } });
    const { rows } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.round_transferred' AND payload->>'dossierId' = $1", [
      received.dossierId,
    ]);
    expect(rows).toHaveLength(1);
    expect((await t.app.dossiers.list(officer, { filter: "awaiting_next_round" })).map((d) => d.id)).toEqual([unreceived.dossierId]);

    await t.drainJobs();
    const notices = await t.app.notifications.list(received.owner);
    expect(notices.find((n) => n.kind === "dossier_round_transferred")).toMatchObject({ link: `/chu-the/ho-so/${received.dossierId}` });
  });
});
