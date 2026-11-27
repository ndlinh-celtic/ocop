import type { Role } from "../identity/roles";

/**
 * Which Vai trò đang dùng may take each action of this module that has no resource, merged by identity/policy.ts. Its
 * actions on one hồ sơ are the transition table of dossiers/transitions.ts. Every row shows in docs/policy-matrix.md.
 */
export const CRITERIA_PERMISSIONS = {
  // Phiên bản tiêu chí (spec #16): only Quản trị writes them or sees drafts.
  "criteria.import": ["admin"],
  "criteria.read_draft": ["admin"],
  "criteria.publish": ["admin"],
  "criteria.preview": ["admin"],
  "criteria.edit": ["admin"],
  "criteria.copy": ["admin"],
  "criteria.delete": ["admin"],
} as const satisfies Record<string, readonly Role[]>;
