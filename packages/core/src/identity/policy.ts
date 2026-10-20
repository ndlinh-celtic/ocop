import type { Actor } from "../shared/context";
import { forbidden } from "../shared/errors";
import type { Role } from "./roles";

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
} as const satisfies Record<string, readonly Role[]>;

/** Actions any signed-in Người dùng may take on their own data, whatever their Vai trò đang dùng. */
const SELF_ACTIONS = ["notification.read_own", "role.switch_own", "totp.enroll_own", "password.change_own", "reauth.own", "criteria.read_published"] as const;

export type Action = keyof typeof ROLE_ACTIONS | (typeof SELF_ACTIONS)[number];

type PolicyActor = { kind: "user"; activeRole: Role | null } | { kind: "anonymous" | "system" };

export function can(actor: PolicyActor, action: Action): boolean {
  if (actor.kind !== "user") return false;
  if ((SELF_ACTIONS as readonly string[]).includes(action)) return true;
  const allowed = ROLE_ACTIONS[action as keyof typeof ROLE_ACTIONS] as readonly Role[];
  return actor.activeRole !== null && allowed.includes(actor.activeRole);
}

export function authorize(actor: Actor, action: Action): asserts actor is Extract<Actor, { kind: "user" }> {
  if (!can(actor, action)) throw forbidden();
}
