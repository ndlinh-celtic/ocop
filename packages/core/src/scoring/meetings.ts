import { auditEntry } from "../audit/audit";
import { lockDossier } from "../dossiers/edit";
import { dossierNotFound, type DossierState } from "../dossiers/model";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { emit } from "../platform/emit";
import { endOfVnDay } from "../rounds/model";
import { roundNotFound } from "../rounds/manage";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError, forbidden } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import type { Meeting, MeetingState } from "./meeting-model";

/*
 * L15 HD-09 Phiên họp (spec #49 stories 107 to 109): the Chủ tịch or Thư ký of a Hội đồng lập a Phiên họp in a đợt
 * of the Hội đồng, with hồ sơ Sẵn sàng chốt; adds or gỡ hồ sơ not yet chốt; closes it once each hồ sơ is chốt or gỡ.
 * A hồ sơ waits in one open Phiên họp at a time (the DB keeps one pending row per hồ sơ, too).
 */

const MAX_TEXT = 500;

export const meetingNotFound = () => new DomainError("not_found", "Không tìm thấy Phiên họp");

/** The Hội đồng of the Chủ tịch or Thư ký's Vai trò đang dùng. */
function councilOf(actor: UserActor): string {
  const scope = dataScopeOf(actor);
  if (scope.kind !== "council") throw forbidden();
  return scope.councilId;
}

async function ownMeeting(tx: Tx, actor: UserActor, meetingId: unknown, lock: boolean): Promise<Meeting> {
  assertIdShape(meetingId, meetingNotFound);
  const meeting = lock ? await tx.meetings.lock(meetingId) : await tx.meetings.findById(meetingId);
  if (!meeting || meeting.councilId !== councilOf(actor)) throw meetingNotFound();
  return meeting;
}

const open = (meeting: Meeting) => {
  if (meeting.state !== "open") throw new DomainError("meeting_closed", "Phiên họp đã kết thúc");
};

/** Adds hồ sơ Sẵn sàng chốt of the Phiên họp's đợt, each locked so a chốt or another Phiên họp queues behind it. */
async function addDossiers(deps: CoreDeps, tx: Tx, actor: UserActor, meeting: Meeting, dossierIds: readonly unknown[]): Promise<string[]> {
  const added: string[] = [];
  for (const id of [...new Set(dossierIds)].sort()) {
    const d = await lockDossier(tx, actor, id);
    if (d.roundId !== meeting.roundId) throw new DomainError("dossier_not_in_round", `Hồ sơ ${d.code} không thuộc đợt của Phiên họp`);
    if (d.state !== "member_confirmed") throw new DomainError("not_ready_to_finalize", `Hồ sơ ${d.code} chưa Sẵn sàng chốt`);
    const ok = (await tx.meetings.pendingOf(d.id)) === null && (await tx.meetings.addDossier({ meetingId: meeting.id, dossierId: d.id, addedBy: actor.userId, addedAt: deps.clock.now(), resultId: null }));
    if (!ok) throw new DomainError("already_in_meeting", `Hồ sơ ${d.code} đã thuộc một Phiên họp chưa kết thúc`);
    added.push(d.id);
  }
  return added;
}

async function record(deps: CoreDeps, tx: Tx, actor: UserActor, meeting: Meeting, action: string, type: "scoring.meeting_created" | "scoring.meeting_changed" | "scoring.meeting_closed", metadata: Record<string, unknown>) {
  await tx.audit.append(auditEntry(actor, deps.ids.next(), deps.clock.now(), { action, targetType: "meeting", targetId: meeting.id, after: { state: meeting.state }, metadata }));
  await emit(deps, tx, { type, payload: { meetingId: meeting.id, councilId: meeting.councilId, roundId: meeting.roundId } });
}

export interface CreateMeetingInput {
  roundId: string;
  title: string;
  /** YYYY-MM-DD. */
  heldOn: string;
  location: string;
  dossierIds?: string[];
}

/** Story 107: lập a Phiên họp of the actor's Hội đồng in one of its đợt. */
export function createMeeting(deps: CoreDeps) {
  return async (actor: Actor, input: CreateMeetingInput): Promise<{ meetingId: string }> => {
    authorize(actor, "scoring.meeting.manage");
    const councilId = councilOf(actor);
    const title = typeof input.title === "string" ? input.title.trim() : "";
    const location = typeof input.location === "string" ? input.location.trim() : "";
    if (!title) throw new DomainError("title_required", "Nhập tiêu đề Phiên họp");
    if (!location) throw new DomainError("location_required", "Nhập địa điểm họp");
    if (title.length > MAX_TEXT || location.length > MAX_TEXT) throw new DomainError("field_too_long", "Nội dung quá dài");
    endOfVnDay(input.heldOn);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.roundId, roundNotFound);
      const round = await tx.rounds.findById(input.roundId);
      if (!round || round.councilId !== councilId) throw roundNotFound();
      const now = deps.clock.now();
      const meeting: Meeting = { id: deps.ids.next(), councilId, roundId: round.id, title, heldOn: input.heldOn, location, state: "open", createdBy: actor.userId, createdAt: now, closedBy: null, closedAt: null };
      await tx.meetings.insert(meeting);
      const added = await addDossiers(deps, tx, actor, meeting, input.dossierIds ?? []);
      await record(deps, tx, actor, meeting, "scoring.meeting.created", "scoring.meeting_created", { title, heldOn: meeting.heldOn, location, dossierIds: added });
      return { meetingId: meeting.id };
    });
  };
}

/** Story 108: adds hồ sơ Sẵn sàng chốt to an open Phiên họp. */
export function addMeetingDossiers(deps: CoreDeps) {
  return async (actor: Actor, input: { meetingId: string; dossierIds: string[] }): Promise<void> => {
    authorize(actor, "scoring.meeting.manage");
    if (!Array.isArray(input.dossierIds) || input.dossierIds.length === 0) throw new DomainError("dossiers_required", "Chọn ít nhất một hồ sơ");
    return deps.uow.run(async (tx) => {
      const meeting = await ownMeeting(tx, actor, input.meetingId, true);
      open(meeting);
      const added = await addDossiers(deps, tx, actor, meeting, input.dossierIds);
      await record(deps, tx, actor, meeting, "scoring.meeting.dossiers_added", "scoring.meeting_changed", { dossierIds: added });
    });
  };
}

/** Story 108: gỡ a hồ sơ not yet chốt from an open Phiên họp. */
export function removeMeetingDossier(deps: CoreDeps) {
  return async (actor: Actor, input: { meetingId: string; dossierId: string }): Promise<void> => {
    authorize(actor, "scoring.meeting.manage");
    return deps.uow.run(async (tx) => {
      const meeting = await ownMeeting(tx, actor, input.meetingId, true);
      open(meeting);
      const d = await lockDossier(tx, actor, input.dossierId);
      if (!(await tx.meetings.removeDossier(meeting.id, d.id))) throw new DomainError("not_in_meeting", "Hồ sơ không chờ chốt trong Phiên họp này");
      await record(deps, tx, actor, meeting, "scoring.meeting.dossier_removed", "scoring.meeting_changed", { dossierId: d.id });
    });
  };
}

/** Kết thúc a Phiên họp once each of its hồ sơ is chốt or gỡ. */
export function closeMeeting(deps: CoreDeps) {
  return async (actor: Actor, input: { meetingId: string }): Promise<void> => {
    authorize(actor, "scoring.meeting.manage");
    return deps.uow.run(async (tx) => {
      const meeting = await ownMeeting(tx, actor, input.meetingId, true);
      open(meeting);
      const pending = (await tx.meetings.dossiers(meeting.id)).filter((r) => r.resultId === null).length;
      if (pending > 0) throw new DomainError("meeting_has_pending_dossiers", `Còn ${pending} hồ sơ chưa chốt điểm; chốt hoặc gỡ trước khi kết thúc Phiên họp`);
      const now = deps.clock.now();
      const closed: Meeting = { ...meeting, state: "closed", closedBy: actor.userId, closedAt: now };
      await tx.meetings.update(closed);
      await record(deps, tx, actor, closed, "scoring.meeting.closed", "scoring.meeting_closed", {});
    });
  };
}

export interface MeetingSummary {
  id: string;
  round: { id: string; name: string };
  title: string;
  heldOn: string;
  location: string;
  state: MeetingState;
  dossierCount: number;
  finalizedCount: number;
}

export interface MeetingDossierView {
  dossierId: string;
  code: string;
  productName: string;
  state: DossierState;
  /** Set once chốt in this Phiên họp. */
  result: { n: number; total: number; star: number; flagged: boolean; finalizedAt: Date } | null;
}

export interface MeetingView extends MeetingSummary {
  createdAt: Date;
  closedAt: Date | null;
  dossiers: MeetingDossierView[];
  /** Hồ sơ Sẵn sàng chốt of the đợt not waiting in any Phiên họp: what may be added. */
  candidates: { dossierId: string; code: string; productName: string }[];
}

/** S44: the Phiên họp of the actor's Hội đồng, newest ngày họp first. */
export function listMeetings(deps: CoreDeps) {
  return async (actor: Actor, input: { roundId?: string } = {}): Promise<MeetingSummary[]> => {
    authorize(actor, "scoring.meeting.manage");
    const councilId = councilOf(actor);
    return deps.uow.run(async (tx) => {
      const out: MeetingSummary[] = [];
      for (const m of await tx.meetings.list(councilId, input.roundId)) out.push(await summaryOf(tx, m));
      return out;
    });
  };
}

async function summaryOf(tx: Tx, m: Meeting): Promise<MeetingSummary> {
  const rows = await tx.meetings.dossiers(m.id);
  const round = await tx.rounds.findById(m.roundId);
  return {
    id: m.id,
    round: { id: m.roundId, name: round?.name ?? "" },
    title: m.title,
    heldOn: m.heldOn,
    location: m.location,
    state: m.state,
    dossierCount: rows.length,
    finalizedCount: rows.filter((r) => r.resultId !== null).length,
  };
}

/** S44: one Phiên họp with its hồ sơ and, while open, the hồ sơ that may join it. */
export function getMeeting(deps: CoreDeps) {
  return async (actor: Actor, input: { meetingId: string }): Promise<MeetingView> => {
    authorize(actor, "scoring.meeting.manage");
    return deps.uow.run(async (tx) => {
      const meeting = await ownMeeting(tx, actor, input.meetingId, false);
      const scope = dataScopeOf(actor);
      const dossiers: MeetingDossierView[] = [];
      for (const row of await tx.meetings.dossiers(meeting.id)) {
        const d = await tx.dossiers.findById(scope, row.dossierId);
        if (!d) throw dossierNotFound();
        const r = row.resultId ? (await tx.aggregateResults.list(d.id)).find((x) => x.id === row.resultId) : undefined;
        dossiers.push({
          dossierId: d.id,
          code: d.code,
          productName: d.productName,
          state: d.state,
          result: r ? { n: r.n, total: r.total, star: r.star, flagged: r.flagged, finalizedAt: r.finalizedAt } : null,
        });
      }
      const candidates: MeetingView["candidates"] = [];
      if (meeting.state === "open") {
        for (const d of await tx.dossiers.list(scope, { roundId: meeting.roundId, state: "member_confirmed" })) {
          if (!(await tx.meetings.pendingOf(d.id))) candidates.push({ dossierId: d.id, code: d.code, productName: d.productName });
        }
      }
      return { ...(await summaryOf(tx, meeting)), createdAt: meeting.createdAt, closedAt: meeting.closedAt, dossiers, candidates };
    });
  };
}
