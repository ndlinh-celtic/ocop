import type { Role } from "../identity/roles";
import type { DataScope } from "../identity/scope";
import type { DomainError } from "../shared/errors";
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
export const DOSSIER_ACTIONS = ["dossier.edit", "dossier.evidence.add", "dossier.delete"] as const;
export type DossierAction = (typeof DOSSIER_ACTIONS)[number];

export const DOSSIER_EVENT_TYPES = ["dossier.created", "dossier.updated", "dossier.evidence_added", "dossier.deleted"] as const;
export type DossierEventType = (typeof DOSSIER_EVENT_TYPES)[number];

export const TRANSITIONS: readonly TransitionRule[] = [
  // L02 CT-03: the Chủ thể writes its Nháp (#39 adds the same rows from supplement_requested).
  { action: "dossier.edit", from: "draft", to: "draft", roles: ["entity_owner"], event: "dossier.updated", timeline: false },
  { action: "dossier.evidence.add", from: "draft", to: "draft", roles: ["entity_owner"], event: "dossier.evidence_added", timeline: false },
  // Story 26: a Nháp, which by this table has never been submitted, may be deleted.
  { action: "dossier.delete", from: "draft", to: "draft", roles: ["entity_owner"], event: "dossier.deleted", timeline: true },
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
