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
  "dossier.checklist_assessed",
] as const;
export type DossierEventType = (typeof DOSSIER_EVENT_TYPES)[number];

export const TRANSITIONS: readonly TransitionRule[] = [
  // L02 CT-03: the Chủ thể writes its Nháp (#39 adds the same rows from supplement_requested).
  { action: "dossier.edit", from: "draft", to: "draft", roles: ["entity_owner"], event: "dossier.updated", timeline: false },
  { action: "dossier.evidence.add", from: "draft", to: "draft", roles: ["entity_owner"], event: "dossier.evidence_added", timeline: false },
  // L02 CT-05, CT-06: minh chứng theo tiêu chí, giải trình and tự chấm thử on the bản làm việc.
  { action: "dossier.evidence.remove", from: "draft", to: "draft", roles: ["entity_owner"], event: "dossier.evidence_removed", timeline: false },
  { action: "dossier.evidence.link", from: "draft", to: "draft", roles: ["entity_owner"], event: "dossier.evidence_linked", timeline: false },
  { action: "dossier.self_score", from: "draft", to: "draft", roles: ["entity_owner"], event: "dossier.self_scored", timeline: false },
  { action: "dossier.explain", from: "draft", to: "draft", roles: ["entity_owner"], event: "dossier.explained", timeline: false },
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
