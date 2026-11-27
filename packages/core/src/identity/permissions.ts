import type { Role } from "../identity/roles";

/**
 * Which Vai trò đang dùng may take each action of this module that has no resource, merged by identity/policy.ts. Its
 * actions on one hồ sơ are the transition table of dossiers/transitions.ts. Every row shows in docs/policy-matrix.md.
 */
export const IDENTITY_PERMISSIONS = {
  "user.create": ["admin"],
  "user.list": ["admin"],
  "user.resend_activation": ["admin"],
  "role.grant": ["admin"],
  "role.revoke": ["admin"],
} as const satisfies Record<string, readonly Role[]>;
