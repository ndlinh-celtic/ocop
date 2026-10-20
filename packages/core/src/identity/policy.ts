import { dossierInScope, ruleFor, type DossierAction, type DossierRef } from "../dossiers/transitions";
import type { Actor } from "../shared/context";
import { forbidden } from "../shared/errors";
import type { Role } from "./roles";
import { dataScopeOf } from "./scope";

/**
 * Policy for the actions of step 1 (spec #1). Rules that depend on a resource's Phạm vi or state
 * (hồ sơ, phiếu chấm) are added beside this table as their modules arrive.
 */
const ROLE_ACTIONS = {
  "user.create": ["admin"],
  "user.list": ["admin"],
  "user.resend_activation": ["admin"],
  "role.grant": ["admin"],
  "role.revoke": ["admin"],
  "audit.search": ["admin"],
  "delivery.list": ["admin"],
  "file.test_upload": ["admin"],
  // Phiên bản tiêu chí (spec #16): only Quản trị writes them or sees drafts.
  "criteria.import": ["admin"],
  "criteria.read_draft": ["admin"],
  "criteria.publish": ["admin"],
  "criteria.preview": ["admin"],
  "criteria.edit": ["admin"],
  "criteria.copy": ["admin"],
  "criteria.delete": ["admin"],
  // Đợt đánh giá (spec #16 story 63): only Cán bộ Sở (Phạm vi tỉnh) creates, opens and changes rounds.
  "round.manage": ["province_officer"],
  // Chủ thể (spec #30): who may read them at all; which ones is the DataScope of identity/scope.ts.
  "entity.read": ["entity_owner", "ward_officer"],
  // The Chủ thể keeps its own organisation details and giấy tờ pháp lý (L01 CT-02).
  "entity.update": ["entity_owner"],
  "entity.legal_document.manage": ["entity_owner"],
  // The full số định danh cá nhân, audited as a personal data access (story 13).
  "entity.personal_id.reveal": ["entity_owner", "ward_officer"],
  // L01 (stories 11, 12): a Cán bộ xã creates a Chủ thể of their xã and changes its Người dùng đại diện's email.
  "entity.create": ["ward_officer"],
  "entity.representative_email.change": ["ward_officer"],
  // Hồ sơ (spec #30): who may read or start them at all. What may be done to one hồ sơ is the transition
  // table of dossiers/transitions.ts, checked by can(actor, action, dossier).
  "dossier.read": ["entity_owner", "ward_officer"],
  "dossier.create": ["entity_owner"],
  "dossier.evidence.upload": ["entity_owner"],
  // L05 XA-02: the Cán bộ xã of their own xã, to choose a Cán bộ phụ trách from.
  "dossier.handler.list": ["ward_officer"],
  // #37: the Phiếu đăng ký and Báo cáo tự đánh giá of a Phiên bản nộp, for whoever's Phạm vi covers the hồ sơ.
  "dossier.document.download": ["entity_owner", "ward_officer"],
} as const satisfies Record<string, readonly Role[]>;

/** Actions any signed-in Người dùng may take on their own data, whatever their Vai trò đang dùng. */
const SELF_ACTIONS = ["notification.read_own", "role.switch_own", "totp.enroll_own", "password.change_own", "reauth.own", "criteria.read_published", "round.read"] as const;

export type Action = keyof typeof ROLE_ACTIONS | (typeof SELF_ACTIONS)[number];

type PolicyActor = { kind: "user"; activeRole: Role | null } | { kind: "anonymous" | "system" };

/**
 * `can(actor, action)`: whether the Vai trò đang dùng may take an action that has no resource.
 * `can(actor, action, dossier)`: whether it may take this action on this loaded hồ sơ: the transition
 * table has a row for the action from the hồ sơ's state that lists the Vai trò, and the actor's Phạm vi
 * covers the hồ sơ. Guards that depend on time are checked again by transition().
 */
export function can(actor: PolicyActor, action: Action): boolean;
export function can(actor: Actor, action: DossierAction, dossier: DossierRef): boolean;
export function can(actor: PolicyActor | Actor, action: Action | DossierAction, dossier?: DossierRef): boolean {
  if (actor.kind !== "user") return false;
  if (dossier) {
    const rule = ruleFor(action as DossierAction, dossier.state);
    return !!rule && actor.activeRole !== null && rule.roles.includes(actor.activeRole) && dossierInScope(dataScopeOf(actor as Actor), dossier);
  }
  if ((SELF_ACTIONS as readonly string[]).includes(action)) return true;
  const allowed = ROLE_ACTIONS[action as keyof typeof ROLE_ACTIONS] as readonly Role[];
  return actor.activeRole !== null && allowed.includes(actor.activeRole);
}

export function authorize(actor: Actor, action: Action): asserts actor is Extract<Actor, { kind: "user" }> {
  if (!can(actor, action)) throw forbidden();
}
