import { auditEntry } from "../audit/audit";
import { lockDossier } from "../dossiers/edit";
import type { DossierState } from "../dossiers/model";
import { transition } from "../dossiers/transition";
import { ownUpload } from "../files/attach";
import type { FileStatus } from "../files/model";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { endOfVnDay, vnDateOf } from "../rounds/model";
import { chotResultOf, meetingNotFound } from "../scoring/meetings";
import type { Meeting, MeetingState } from "../scoring/meeting-model";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { issueCertificates } from "./certificate";
import { sectionOf, type DecisionKind, type DecisionSection, type RecognitionDecision, type RecognitionDecisionDossier } from "./decision-model";

/*
 * L16 HD-11 Quyết định công nhận theo Phiên họp (#83, spec #79 stories 9 to 16, 19 to 21). The Cán bộ Sở records the
 * signed quyết định of a closed Phiên họp whose every hồ sơ has its kết quả chốt hiện hành. In one transaction, holding
 * the Phiên họp FOR UPDATE: the decision and its hồ sơ by mục, then for each hồ sơ named (by id, so concurrent callers
 * lock in the same order) Công bố kết quả: 3 and 4 sao → Công nhận 3/4 sao, 5 sao stays Đã chốt điểm. Hồ sơ dưới 3 sao
 * are not named and do not change. No Xác thực lại (spec #79), and nothing undoes it (story 19).
 */

const MAX_NUMBER = 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface RecordMeetingDecisionInput {
  meetingId: string;
  /** Số quyết định as printed, e.g. "123/QĐ-UBND". */
  number: string;
  /** Ngày ký, YYYY-MM-DD; not after today in Vietnam. */
  signedOn: string;
  /** The signed PDF the Cán bộ Sở uploaded with purpose `recognition_decision`. */
  fileId: string;
}

export interface RecordedDecision {
  decisionId: string;
  /** The hồ sơ named, by id, each in its mục. */
  dossiers: { dossierId: string; section: DecisionSection }[];
}

/** Story 11: the hồ sơ of the Phiên họp without a kết quả chốt hiện hành, so the quyết định would miss them. */
export class MeetingPendingDossiersError extends DomainError {
  static override readonly brand = "MeetingPendingDossiersError";

  constructor(readonly dossiers: readonly { dossierId: string; code: string }[]) {
    super(
      "meeting_has_pending_dossiers",
      `Phiên họp còn hồ sơ chưa có kết quả chốt hiện hành: ${dossiers.map((d) => d.code).join(", ")}. Hội đồng cần chốt lại các hồ sơ này trước khi ghi nhận quyết định`,
    );
  }
}

export function numberOf(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new DomainError("decision_number_required", "Cần nhập số quyết định");
  if (text.length > MAX_NUMBER) throw new DomainError("field_too_long", "Số quyết định quá dài");
  return text;
}

/** A ngày ký: a real calendar date, not after `today` (both YYYY-MM-DD, Vietnam). */
export function signedOnOf(value: unknown, today: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  const invalid = () => new DomainError("signed_on_invalid", "Ngày ký không hợp lệ");
  if (!ISO_DATE.test(text)) throw invalid();
  try {
    endOfVnDay(text);
  } catch {
    throw invalid();
  }
  if (text > today) throw new DomainError("signed_on_in_future", "Ngày ký không được sau ngày hôm nay");
  return text;
}

/** The hồ sơ of a Phiên họp with the kết quả chốt hiện hành each was chốt with there (null once a Mở khóa superseded it). */
async function meetingResults(tx: Tx, meetingId: string) {
  const out: { dossierId: string; star: number | null }[] = [];
  for (const row of await tx.meetings.dossiers(meetingId)) {
    const result = await chotResultOf(tx, row);
    out.push({ dossierId: row.dossierId, star: result?.star ?? null });
  }
  return out;
}

/** Stories 9 to 16: ghi nhận the Quyết định công nhận of a Phiên họp and Công bố kết quả of every hồ sơ it names. */
export function recordMeetingDecision(deps: CoreDeps) {
  return async (actor: Actor, input: RecordMeetingDecisionInput): Promise<RecordedDecision> => {
    authorize(actor, "results.decision.record");
    const number = numberOf(input.number);
    const now = deps.clock.now();
    const signedOn = signedOnOf(input.signedOn, vnDateOf(now));
    assertIdShape(input.meetingId, meetingNotFound);
    return deps.uow.run(async (tx) => {
      const meeting = await tx.meetings.lock(input.meetingId);
      if (!meeting) throw meetingNotFound();
      if (meeting.state !== "closed") throw new DomainError("meeting_not_closed", "Phiên họp chưa kết thúc nên chưa ghi nhận được quyết định");
      if (await tx.recognitionDecisions.ofMeeting(meeting.id)) {
        throw new DomainError("meeting_already_has_decision", "Phiên họp này đã có Quyết định công nhận");
      }
      const results = await meetingResults(tx, meeting.id);
      const pending = results.filter((r) => r.star === null);
      if (pending.length > 0) {
        const scope = dataScopeOf(actor);
        const listed: { dossierId: string; code: string }[] = [];
        for (const p of pending) listed.push({ dossierId: p.dossierId, code: (await tx.dossiers.findById(scope, p.dossierId))?.code ?? "" });
        throw new MeetingPendingDossiersError(listed);
      }
      const named = results
        .flatMap((r) => {
          const section = sectionOf(r.star!);
          return section ? [{ dossierId: r.dossierId, section }] : [];
        })
        .sort((a, b) => a.dossierId.localeCompare(b.dossierId));
      if (named.length === 0) {
        throw new DomainError("decision_without_recognized", "Phiên họp không có hồ sơ nào đạt từ 3 sao nên không có quyết định công nhận");
      }
      const file = await ownUpload(
        tx,
        actor,
        input.fileId,
        "recognition_decision",
        () => new DomainError("file_required", "Tải lên bản Quyết định công nhận đã ký (PDF)"),
      );

      const decision: RecognitionDecision = {
        id: deps.ids.next(),
        kind: "meeting",
        meetingId: meeting.id,
        number,
        signedOn,
        fileId: file.id,
        recordedBy: actor.userId,
        recordedAt: now,
      };
      const rows: RecognitionDecisionDossier[] = named.map((n) => ({ decisionId: decision.id, ...n }));
      if (!(await tx.recognitionDecisions.insert(decision, rows))) {
        throw new DomainError("meeting_already_has_decision", "Phiên họp này đã có Quyết định công nhận");
      }
      for (const { dossierId, section } of named) await publish(deps, tx, actor, dossierId, section, decision);
      // #84: the Giấy chứng nhận of the hồ sơ recognized, numbered in this transaction; Hạng công nhận = Hạng sao here.
      await issueCertificates(
        deps,
        tx,
        actor,
        decision,
        named.flatMap((n) => (n.section === "five_star_proposal" ? [] : [{ dossierId: n.dossierId, recognizedStar: n.section === "four_star" ? 4 : 3 }])),
      );
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "results.decision.recorded",
          targetType: "recognition_decision",
          targetId: decision.id,
          after: { kind: decision.kind, meetingId: meeting.id, number, signedOn, fileId: file.id },
          metadata: { dossiers: named },
        }),
      );
      return { decisionId: decision.id, dossiers: named };
    });
  };
}

/** Công bố kết quả of one hồ sơ named in a quyết định: the transition row of its mục, setting result_published_at once. */
async function publish(deps: CoreDeps, tx: Tx, actor: UserActor, dossierId: string, section: DecisionSection, decision: RecognitionDecision) {
  const before = await lockDossier(tx, actor, dossierId);
  const recognized = section !== "five_star_proposal";
  await transition(deps, tx, actor, before, {
    action: recognized ? "dossier.recognize" : "dossier.result_publish",
    expectedVersion: before.version,
    patch: { resultPublishedAt: deps.clock.now() },
    metadata: { decisionId: decision.id, section, number: decision.number, signedOn: decision.signedOn },
    outcome: recognized ? "recognized" : "five_star_proposal",
  });
}

export interface DecisionView {
  id: string;
  kind: DecisionKind;
  number: string;
  signedOn: string;
  file: { id: string; fileName: string; status: FileStatus };
  recordedAt: Date;
  recordedBy: { userId: string; fullName: string };
}

export interface MeetingDecisionDossier {
  dossierId: string;
  code: string;
  productName: string;
  state: DossierState;
  /** The kết quả chốt hiện hành it was chốt with in the Phiên họp; null when a Mở khóa superseded it. */
  result: { total: number; star: number } | null;
  /** Its mục in the decision once recorded, or the mục it would get; null below 3 sao. */
  section: DecisionSection | null;
}

export interface MeetingDecisionView {
  meeting: Pick<Meeting, "id" | "title" | "heldOn" | "location"> & {
    state: MeetingState;
    council: { id: string; name: string };
    round: { id: string; name: string };
  };
  decision: DecisionView | null;
  dossiers: MeetingDecisionDossier[];
}

export interface MeetingForDecision {
  id: string;
  title: string;
  heldOn: string;
  state: MeetingState;
  council: { id: string; name: string };
  round: { id: string; name: string };
  dossierCount: number;
  decision: { id: string; number: string; signedOn: string } | null;
}

async function decisionView(tx: Tx, d: RecognitionDecision): Promise<DecisionView> {
  const file = await tx.files.findById(d.fileId);
  const user = await tx.users.findById(d.recordedBy);
  return {
    id: d.id,
    kind: d.kind,
    number: d.number,
    signedOn: d.signedOn,
    file: { id: d.fileId, fileName: file?.fileName ?? "", status: file?.status ?? "blocked" },
    recordedAt: d.recordedAt,
    recordedBy: { userId: d.recordedBy, fullName: user?.fullName ?? "" },
  };
}

/** S-Sở Phiên họp list: every Phiên họp of every Hội đồng, newest ngày họp first, with its quyết định if recorded. */
export function meetingsForDecision(deps: CoreDeps) {
  return async (actor: Actor): Promise<MeetingForDecision[]> => {
    authorize(actor, "results.decision.record");
    return deps.uow.run(async (tx) => {
      const out: MeetingForDecision[] = [];
      for (const council of await tx.councils.list()) {
        for (const m of await tx.meetings.list(council.id)) {
          const round = await tx.rounds.findById(m.roundId);
          const decision = await tx.recognitionDecisions.ofMeeting(m.id);
          out.push({
            id: m.id,
            title: m.title,
            heldOn: m.heldOn,
            state: m.state,
            council: { id: council.id, name: council.name },
            round: { id: m.roundId, name: round?.name ?? "" },
            dossierCount: (await tx.meetings.dossiers(m.id)).length,
            decision: decision && { id: decision.id, number: decision.number, signedOn: decision.signedOn },
          });
        }
      }
      return out.sort((a, b) => b.heldOn.localeCompare(a.heldOn) || a.title.localeCompare(b.title, "vi"));
    });
  };
}

/** One Phiên họp as the Sở records its quyết định: its hồ sơ with the kết quả chốt and mục, and the quyết định once recorded. */
export function meetingDecision(deps: CoreDeps) {
  return async (actor: Actor, input: { meetingId: string }): Promise<MeetingDecisionView> => {
    authorize(actor, "results.decision.record");
    assertIdShape(input.meetingId, meetingNotFound);
    return deps.uow.run(async (tx) => {
      const meeting = await tx.meetings.findById(input.meetingId);
      if (!meeting) throw meetingNotFound();
      const council = await tx.councils.findById(meeting.councilId);
      const round = await tx.rounds.findById(meeting.roundId);
      const decision = await tx.recognitionDecisions.ofMeeting(meeting.id);
      const sections = new Map(decision ? (await tx.recognitionDecisions.dossiers(decision.id)).map((r) => [r.dossierId, r.section]) : []);
      const scope = dataScopeOf(actor);
      const dossiers: MeetingDecisionDossier[] = [];
      for (const row of await tx.meetings.dossiers(meeting.id)) {
        const d = await tx.dossiers.findById(scope, row.dossierId);
        if (!d) continue;
        const r = await chotResultOf(tx, row);
        dossiers.push({
          dossierId: d.id,
          code: d.code,
          productName: d.productName,
          state: d.state,
          result: r && { total: r.total, star: r.star },
          section: decision ? (sections.get(d.id) ?? null) : r ? sectionOf(r.star) : null,
        });
      }
      dossiers.sort((a, b) => a.code.localeCompare(b.code));
      return {
        meeting: {
          id: meeting.id,
          title: meeting.title,
          heldOn: meeting.heldOn,
          location: meeting.location,
          state: meeting.state,
          council: { id: meeting.councilId, name: council?.name ?? "" },
          round: { id: meeting.roundId, name: round?.name ?? "" },
        },
        decision: decision && (await decisionView(tx, decision)),
        dossiers,
      };
    });
  };
}

/** The signed quyết định PDF, for any Cán bộ Sở: a short-lived link, audited like any download. */
export function downloadDecision(deps: CoreDeps) {
  return async (actor: Actor, input: { decisionId: string }): Promise<{ url: string; expiresAt: Date }> => {
    authorize(actor, "results.decision.record");
    const notFound = () => new DomainError("not_found", "Không tìm thấy Quyết định công nhận");
    assertIdShape(input.decisionId, notFound);
    return deps.uow.run(async (tx) => {
      const decision = await tx.recognitionDecisions.findById(input.decisionId);
      const file = decision && (await tx.files.findById(decision.fileId));
      if (!decision || !file) throw notFound();
      if (file.status !== "clean") throw new DomainError("file_not_ready", "Tệp chưa sẵn sàng để tải xuống");
      const get = await deps.files.presignGet(file.storageKey, { fileName: file.fileName, expiresInSec: deps.settings.files.downloadUrlTtlSec });
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), deps.clock.now(), {
          action: "file.download_issued",
          targetType: "file",
          targetId: file.id,
          metadata: { decisionId: decision.id },
        }),
      );
      return { url: get.url, expiresAt: get.expiresAt };
    });
  };
}
