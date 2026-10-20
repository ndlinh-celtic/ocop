import type { Role } from "../identity/roles";
import type { DataScope } from "../identity/scope";
import { DomainError } from "../shared/errors";
import type { Dossier, DossierState } from "./model";

/**
 * What can happen to a hồ sơ, as data (spec #30 "Vòng đời hồ sơ"). Each row says: from which state,
 * into which state, which Vai trò đang dùng may do it, and an optional guard on the hồ sơ. A same-state
 * row (from = to) is an event that changes the hồ sơ without moving it: editing a Nháp, Tiếp nhận,
 * Cán bộ phụ trách, Chuyển xã. Later tickets add rows and actions here; transition() and can() stay as
 * they are.
 */
export interface TransitionRule {
  action: DossierAction;
  from: DossierState;
  to: DossierState;
  roles: readonly Role[];
  /** The domain event written to the outbox. */
  event: DossierEventType;
  /** A refusal when the hồ sơ, at `now`, does not allow the move; null when it does. */
  guard?: (d: Dossier, now: Date) => DomainError | null;
  /** Whether the move is a row of the timeline (story 34). Autosaving a Nháp is not. */
  timeline: boolean;
}

/** What policy needs of a hồ sơ: its state and what decides whose Phạm vi covers it. */
export type DossierRef = Pick<Dossier, "state" | "entityId" | "wardId" | "firstForwardedAt">;

/** Actions on an existing hồ sơ; their audit action is the same string. */
export const DOSSIER_ACTIONS = [
  "dossier.edit",
  "dossier.evidence.add",
  "dossier.evidence.remove",
  "dossier.evidence.link",
  "dossier.self_score",
  "dossier.explain",
  "dossier.delete",
  "dossier.submit",
  "dossier.withdraw",
  "dossier.receive",
  "dossier.handler.change",
  "dossier.supplement.request",
  "dossier.supplement.respond",
  "dossier.resubmit",
  "dossier.supplement.close",
  "dossier.reject",
  "dossier.ward_transfer",
  "dossier.checklist.assess",
] as const;
export type DossierAction = (typeof DOSSIER_ACTIONS)[number];

export const DOSSIER_EVENT_TYPES = [
  "dossier.created",
  "dossier.updated",
  "dossier.evidence_added",
  "dossier.evidence_removed",
  "dossier.evidence_linked",
  "dossier.self_scored",
  "dossier.explained",
  "dossier.deleted",
  "dossier.submitted",
  "dossier.withdrawn",
  "dossier.received",
  "dossier.handler_changed",
  "dossier.supplement_requested",
  "dossier.supplement_answered",
  "dossier.resubmitted",
  "dossier.closed_unsupplemented",
  "dossier.rejected_preliminary",
  "dossier.ward_transferred",
  "dossier.checklist_assessed",
] as const;
export type DossierEventType = (typeof DOSSIER_EVENT_TYPES)[number];

export const TRANSITIONS: readonly TransitionRule[] = [
  // L02 CT-03, CT-05, CT-06: the Chủ thể writes its bản làm việc (thông tin sản phẩm, minh chứng theo
  // tiêu chí, giải trình, tự chấm thử), as a Nháp and again while the xã asks for more (L04 CT-11).
  ...(["draft", "supplement_requested"] as const).flatMap((from) =>
    (
      [
        ["dossier.edit", "dossier.updated"],
        ["dossier.evidence.add", "dossier.evidence_added"],
        ["dossier.evidence.remove", "dossier.evidence_removed"],
        ["dossier.evidence.link", "dossier.evidence_linked"],
        ["dossier.self_score", "dossier.self_scored"],
        ["dossier.explain", "dossier.explained"],
      ] as const
    ).map(([action, event]): TransitionRule => ({ action, from, to: from, roles: ["entity_owner"], event, timeline: false })),
  ),
  // Story 26: a Nháp, which by this table has never been submitted, may be deleted.
  { action: "dossier.delete", from: "draft", to: "draft", roles: ["entity_owner"], event: "dossier.deleted", timeline: true },
  // L03 CT-09: nộp into the đợt Đang nhận nộp; the conditions of story 29 are checked by submitDossier.
  { action: "dossier.submit", from: "draft", to: "submitted_to_ward", roles: ["entity_owner"], event: "dossier.submitted", timeline: true },
  // Story 33: rút, only while the xã has not Tiếp nhận the hồ sơ.
  {
    action: "dossier.withdraw",
    from: "submitted_to_ward",
    to: "withdrawn",
    roles: ["entity_owner"],
    event: "dossier.withdrawn",
    timeline: true,
    guard: (d) => (d.receivedAt === null ? null : new DomainError("already_received", "Xã đã tiếp nhận hồ sơ nên không rút được nữa")),
  },
  // L05 XA-02 (story 40): Tiếp nhận, once; it names the Cán bộ phụ trách.
  {
    action: "dossier.receive",
    from: "submitted_to_ward",
    to: "submitted_to_ward",
    roles: ["ward_officer"],
    event: "dossier.received",
    timeline: true,
    guard: (d) => (d.receivedAt === null ? null : new DomainError("already_received", "Hồ sơ đã được tiếp nhận")),
  },
  // L05 XA-03 (story 41): another Cán bộ phụ trách, at any time while the xã handles a received hồ sơ.
  ...(["submitted_to_ward", "supplement_requested"] as const).map(
    (from): TransitionRule => ({
      action: "dossier.handler.change",
      from,
      to: from,
      roles: ["ward_officer"],
      event: "dossier.handler_changed",
      timeline: true,
      guard: (d) => (d.receivedAt !== null ? null : new DomainError("not_received", "Hồ sơ chưa được tiếp nhận")),
    }),
  ),
  // L04 XA-05 (story 50): the xã asks for more on a hồ sơ it has Tiếp nhận, with a hạn bổ sung.
  {
    action: "dossier.supplement.request",
    from: "submitted_to_ward",
    to: "supplement_requested",
    roles: ["ward_officer"],
    event: "dossier.supplement_requested",
    timeline: true,
    guard: (d) => (d.receivedAt !== null ? null : new DomainError("not_received", "Hồ sơ chưa được tiếp nhận")),
  },
  // L04 CT-11 (story 51): the Chủ thể answers each nội dung of the yêu cầu bổ sung.
  {
    action: "dossier.supplement.respond",
    from: "supplement_requested",
    to: "supplement_requested",
    roles: ["entity_owner"],
    event: "dossier.supplement_answered",
    timeline: false,
  },
  // L04 CT-11 (stories 52 to 54): nộp lại while the hạn bổ sung lasts, even after the Hạn nộp xã; the
  // hồ sơ keeps its Tiếp nhận and Cán bộ phụ trách.
  {
    action: "dossier.resubmit",
    from: "supplement_requested",
    to: "submitted_to_ward",
    roles: ["entity_owner"],
    event: "dossier.resubmitted",
    timeline: true,
    guard: (d, now) => (isPastSupplementDeadline(d, now) ? supplementDeadlinePassed() : null),
  },
  // L04 XA-05 (story 56): once the hạn bổ sung has passed, the xã closes the hồ sơ as Không đạt sơ bộ.
  {
    action: "dossier.supplement.close",
    from: "supplement_requested",
    to: "rejected_preliminary",
    roles: ["ward_officer"],
    event: "dossier.closed_unsupplemented",
    timeline: true,
    guard: (d, now) =>
      isPastSupplementDeadline(d, now) ? null : new DomainError("supplement_deadline_not_passed", "Chưa quá hạn bổ sung nên chưa đóng được hồ sơ"),
  },
  // L05 XA-06 (story 63): the xã loại a hồ sơ Đã nộp xã, citing an Điều kiện loại or a Lý do loại sơ bộ.
  { action: "dossier.reject", from: "submitted_to_ward", to: "rejected_preliminary", roles: ["ward_officer"], event: "dossier.rejected_preliminary", timeline: true },
  // L05 (story 47): Chuyển xã moves a hồ sơ Đã nộp xã to the right xã, which Tiếp nhận it afresh.
  { action: "dossier.ward_transfer", from: "submitted_to_ward", to: "submitted_to_ward", roles: ["ward_officer"], event: "dossier.ward_transferred", timeline: true },
  // L06 XA-04 (story 61): the Checklist sơ bộ of a received hồ sơ, editable until it is gửi tỉnh. Nhận xét
  // are the xã's working notes, so this is not a row of the timeline the Chủ thể reads.
  ...(["submitted_to_ward", "supplement_requested"] as const).map(
    (from): TransitionRule => ({
      action: "dossier.checklist.assess",
      from,
      to: from,
      roles: ["ward_officer"],
      event: "dossier.checklist_assessed",
      timeline: false,
      guard: (d) => (d.receivedAt !== null ? null : new DomainError("not_received", "Hồ sơ chưa được tiếp nhận")),
    }),
  ),
];

/** Whether the hạn bổ sung is over at `now`; its last second still counts, like the Hạn nộp xã. */
export const isPastSupplementDeadline = (d: Pick<Dossier, "supplementDeadline">, now: Date) =>
  d.supplementDeadline !== null && now.getTime() > d.supplementDeadline.getTime();

export const supplementDeadlinePassed = () => new DomainError("supplement_deadline_passed", "Đã quá hạn bổ sung nên không nộp lại được");

/** The rule for `action` from the hồ sơ's current state, if the table has one. */
export const ruleFor = (action: DossierAction, state: DossierState) => TRANSITIONS.find((r) => r.action === action && r.from === state);

/**
 * Whether a DataScope covers a loaded hồ sơ: the same rule the repository writes as SQL, applied to a row
 * already in hand. The switch is exhaustive, so a new DataScope branch must decide here too.
 */
export function dossierInScope(scope: DataScope, d: DossierRef): boolean {
  switch (scope.kind) {
    case "entity":
      return d.entityId === scope.entityId;
    case "ward":
      // The xã the hồ sơ was submitted to (or moved to by Chuyển xã); a Nháp belongs to no xã yet.
      return d.wardId === scope.wardId;
    case "none":
      return false;
    default: {
      const unhandled: never = scope;
      throw new Error(`unhandled data scope ${JSON.stringify(unhandled)}`);
    }
  }
}
