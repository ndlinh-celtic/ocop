import { auditEntry } from "../audit/audit";
import { can } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { emit } from "../platform/emit";
import type { UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError, forbidden } from "../shared/errors";
import type { Tx } from "../shared/uow";
import { DOSSIER_STATE_LABEL, dossierNotFound, versionConflict, type Dossier, type DossierState, type DossierStateRow } from "./model";
import { dossierInScope, recordedAction, ruleAllows, ruleFor, TRANSITIONS, type DossierAction, type DossierEventType } from "./transitions";

/** The fields of a hồ sơ a transition may change besides its state and version. */
export type DossierPatch = Partial<Omit<Dossier, "id" | "code" | "entityId" | "criteriaSetId" | "criteriaVersionId" | "state" | "version" | "copiedFrom" | "createdAt" | "createdBy" | "updatedAt" | "councilId" | "readerAssignment">>;

export interface TransitionInput {
  action: DossierAction;
  /** The version the caller last saw; a hồ sơ changed since is refused (story 87). */
  expectedVersion: number;
  patch?: DossierPatch;
  /** Why, when the action carries a reason (rút, loại, trả về…); shown on the timeline. */
  reason?: string | null;
  /** Extra facts for the timeline and the audit row. */
  metadata?: Record<string, unknown>;
  /** The Người dùng the outbox event names for its notices, when only the use case knows them (sao chép, L12). */
  notify?: string[];
}

/**
 * The single way a hồ sơ changes (spec #30): picks the row of the transition table for the action from
 * the hồ sơ's current state, checks the Vai trò đang dùng, the Phạm vi, the guard and the version, then in
 * the caller's transaction writes the hồ sơ with its version bumped, a dossier_event (unless the row is
 * off the timeline), an audit row and an outbox event. Same-state rows go through here too.
 *
 * `before` must have been loaded with `tx.dossiers.lock(scope, id)` so that concurrent callers queue on
 * the row; the version check then refuses the one that arrives second with a stale version.
 */
export async function transition(deps: CoreDeps, tx: Tx, actor: UserActor, before: Dossier, input: TransitionInput): Promise<Dossier> {
  const now = deps.clock.now();
  const rule = allowedRule(actor, before, input.action, now, input.expectedVersion);

  const after: Dossier = { ...before, ...input.patch, state: rule.to, version: before.version + 1, updatedAt: now };
  if (!(await tx.dossiers.update(after, before.version))) throw versionConflict();
  await record(deps, tx, actor, now, {
    dossier: after,
    action: input.action,
    from: before.state,
    event: rule.event,
    timeline: rule.timeline,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
    notify: input.notify,
  });
  return after;
}

/**
 * The checks transition() makes, for a same-state row whose use case changes something beside the hồ sơ and so writes
 * nothing on it (a nháp of a Phiếu chấm, which has its own version): Phạm vi, the row from the current state, the Vai
 * trò and the guard. `before` must still have been loaded with `tx.dossiers.lock(scope, id)`.
 */
export function assertTransitionAllowed(actor: UserActor, before: Dossier, action: DossierAction, now: Date): void {
  allowedRule(actor, before, action, now, before.version);
}

function allowedRule(actor: UserActor, before: Dossier, action: DossierAction, now: Date, expectedVersion: number) {
  if (!dossierInScope(dataScopeOf(actor), before)) throw dossierNotFound();
  const rule = ruleFor(action, before.state);
  if (!rule) {
    if (!TRANSITIONS.some((r) => r.action === action && ruleAllows(r, actor))) throw forbidden();
    throw new DomainError("invalid_state", `Không thể thực hiện thao tác này khi hồ sơ đang ở trạng thái ${DOSSIER_STATE_LABEL[before.state]}`);
  }
  if (!can(actor, action, before)) throw forbidden();
  if (expectedVersion !== before.version) throw versionConflict();
  const refusal = rule.guard?.(before, now);
  if (refusal) throw refusal;
  return rule;
}

/**
 * The creation of a hồ sơ, written like a transition from nothing into its first state: the timeline row,
 * the audit row and the outbox event, in the caller's transaction.
 */
export async function recordCreation(deps: CoreDeps, tx: Tx, actor: UserActor, dossier: Dossier, metadata: Record<string, unknown> = {}) {
  await tx.dossiers.insert(dossier);
  await record(deps, tx, actor, dossier.createdAt, {
    dossier,
    action: "dossier.create",
    from: null,
    event: "dossier.created",
    timeline: true,
    reason: null,
    metadata,
  });
}

/**
 * transition() for a row marked `lookup` (Mở khóa sau chốt): the actor's DataScope covers no hồ sơ, so the use case
 * loaded `before` with the narrow, locked DossierRepo.stateRow. The rule, the Vai trò and the version are checked as
 * transition() checks them; only state, version and updated_at change; timeline, audit and outbox are written the same.
 */
export async function transitionByLookup(deps: CoreDeps, tx: Tx, actor: UserActor, before: DossierStateRow, input: Omit<TransitionInput, "patch">): Promise<DossierStateRow> {
  const rule = ruleFor(input.action, before.state);
  if (!rule) {
    if (!TRANSITIONS.some((r) => r.action === input.action && ruleAllows(r, actor))) throw forbidden();
    throw new DomainError("invalid_state", `Không thể thực hiện thao tác này khi hồ sơ đang ở trạng thái ${DOSSIER_STATE_LABEL[before.state]}`);
  }
  if (rule.lookup !== true || !ruleAllows(rule, actor)) throw forbidden();
  if (input.expectedVersion !== before.version) throw versionConflict();
  const now = deps.clock.now();
  const after: DossierStateRow = { ...before, state: rule.to, version: before.version + 1 };
  if (!(await tx.dossiers.updateState(before.id, before.version, rule.to, now))) throw versionConflict();
  await record(deps, tx, actor, now, {
    dossier: after,
    action: input.action,
    from: before.state,
    event: rule.event,
    timeline: rule.timeline,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
    notify: input.notify,
  });
  return after;
}

interface Recorded {
  dossier: Pick<Dossier, "id" | "entityId" | "state" | "version">;
  action: DossierAction | "dossier.create";
  from: DossierState | null;
  event: DossierEventType;
  timeline: boolean;
  reason: string | null;
  metadata: Record<string, unknown>;
  notify?: string[];
}

/**
 * Writes the timeline row, the audit row and the outbox event of a move. Under Nhập hộ the action is
 * `<action>_on_behalf`, the row names the Chủ thể in `onBehalfOf` and is always on the timeline, so the
 * Chủ thể sees what the Cán bộ xã did for it (stories 73, 74); the outbox event stays the same.
 */
async function record(deps: CoreDeps, tx: Tx, actor: UserActor, now: Date, r: Recorded) {
  const { dossier } = r;
  const action = recordedAction(r.action, actor);
  const onBehalf = actor.onBehalfOf !== undefined;
  if (r.timeline || onBehalf) {
    await tx.dossiers.appendEvent({
      id: deps.ids.next(),
      dossierId: dossier.id,
      action,
      fromState: r.from,
      toState: dossier.state,
      actorUserId: actor.userId,
      actorRole: actor.activeRole,
      occurredAt: now,
      reason: r.reason,
      metadata: onBehalf ? { ...r.metadata, onBehalfOf: actor.onBehalfOf } : r.metadata,
    });
  }
  await tx.audit.append(
    auditEntry(actor, deps.ids.next(), now, {
      action,
      targetType: "dossier",
      targetId: dossier.id,
      before: r.from === null ? null : { state: r.from, version: dossier.version - 1 },
      after: { state: dossier.state, version: dossier.version },
      metadata: { ...r.metadata, ...(r.reason ? { reason: r.reason } : {}) },
    }),
  );
  await emit(deps, tx, { type: r.event, payload: { dossierId: dossier.id, entityId: dossier.entityId, from: r.from, to: dossier.state, actorUserId: actor.userId, ...(r.notify ? { recipientUserIds: r.notify } : {}) } });
}
