import { dossierInScope, recordedAction, ruleAllows, ruleFor, type DossierAction, type DossierRef } from "../dossiers/transitions";
import type { Actor } from "../shared/context";
import { forbidden } from "../shared/errors";
import { mergeTables } from "../shared/tables";
import { AUDIT_PERMISSIONS } from "../audit/permissions";
import { COUNCILS_PERMISSIONS } from "../councils/permissions";
import { CRITERIA_PERMISSIONS } from "../criteria/permissions";
import { DOCUMENTS_PERMISSIONS } from "../documents/permissions";
import { DOSSIERS_PERMISSIONS } from "../dossiers/permissions";
import { ENTITIES_PERMISSIONS } from "../entities/permissions";
import { FILES_PERMISSIONS } from "../files/permissions";
import { IDENTITY_PERMISSIONS } from "./permissions";
import { NOTIFICATIONS_PERMISSIONS } from "../notifications/permissions";
import { RESULTS_PERMISSIONS } from "../results/permissions";
import { ROUNDS_PERMISSIONS } from "../rounds/permissions";
import { SCORING_PERMISSIONS } from "../scoring/permissions";
import { SYSTEM_PERMISSIONS } from "../system/permissions";
import type { Role } from "./roles";
import { dataScopeOf } from "./scope";

/**
 * The actions that have no resource, and the Vai trò that may take them: each module declares its own in its
 * `permissions.ts` (by the action's prefix: `results.*` in results/permissions.ts, `dossier.*` in dossiers/…), merged
 * here. Rules that depend on a hồ sơ's state are the transition table. docs/policy-matrix.md shows the whole matrix and a
 * test keeps it current, so a change of permission is reviewed in one place.
 */
export const ROLE_ACTIONS = mergeTables("permission", [
  IDENTITY_PERMISSIONS,
  AUDIT_PERMISSIONS,
  NOTIFICATIONS_PERMISSIONS,
  FILES_PERMISSIONS,
  CRITERIA_PERMISSIONS,
  ROUNDS_PERMISSIONS,
  COUNCILS_PERMISSIONS,
  ENTITIES_PERMISSIONS,
  DOSSIERS_PERMISSIONS,
  SCORING_PERMISSIONS,
  SYSTEM_PERMISSIONS,
  DOCUMENTS_PERMISSIONS,
  RESULTS_PERMISSIONS,
]);

/** Actions any signed-in Người dùng may take on their own data, whatever their Vai trò đang dùng. */
export const SELF_ACTIONS = [
  "notification.read_own",
  "role.switch_own",
  "totp.enroll_own",
  "password.change_own",
  "reauth.own",
  "criteria.read_published",
  "round.read",
] as const;

export type Action = keyof typeof ROLE_ACTIONS | (typeof SELF_ACTIONS)[number];

type PolicyActor = { kind: "user"; activeRole: Role | null; onBehalfOf?: string } | { kind: "anonymous" | "system" };

/**
 * `can(actor, action)`: whether the Vai trò đang dùng may take an action that has no resource.
 * `can(actor, action, dossier)`: whether it may take this action on this loaded hồ sơ: the transition
 * table has a row for the action from the hồ sơ's state that lists the Vai trò, and the actor's Phạm vi
 * covers the hồ sơ. Guards that depend on time are checked again by transition().
 *
 * An actor doing Nhập hộ (`onBehalfOf`) may take only the `*_on_behalf` variant of an action: a row of
 * ROLE_ACTIONS under that name, or a row of the transition table marked `onBehalf`, and in both cases
 * only as a Cán bộ xã.
 */
export function can(actor: PolicyActor, action: Action): boolean;
export function can(actor: Actor, action: DossierAction, dossier: DossierRef): boolean;
export function can(actor: PolicyActor | Actor, action: Action | DossierAction, dossier?: DossierRef): boolean {
  if (actor.kind !== "user") return false;
  if (dossier) {
    const rule = ruleFor(action as DossierAction, dossier.state);
    return !!rule && ruleAllows(rule, actor) && dossierInScope(dataScopeOf(actor as Actor), dossier);
  }
  if ((SELF_ACTIONS as readonly string[]).includes(action)) return true;
  if (actor.activeRole === null) return false;
  const allowed = ROLE_ACTIONS[recordedAction(action, actor) as keyof typeof ROLE_ACTIONS] as readonly Role[] | undefined;
  return !!allowed && allowed.includes(actor.activeRole);
}

export function authorize(actor: Actor, action: Action): asserts actor is Extract<Actor, { kind: "user" }> {
  if (!can(actor, action)) throw forbidden();
}
