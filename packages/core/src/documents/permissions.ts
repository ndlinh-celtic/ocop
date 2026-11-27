import type { Role } from "../identity/roles";

/**
 * Which Vai trò đang dùng may take each action of this module that has no resource, merged by identity/policy.ts. Its
 * actions on one hồ sơ are the transition table of dossiers/transitions.ts. Every row shows in docs/policy-matrix.md.
 */
export const DOCUMENTS_PERMISSIONS = {
  // #82 (stories 70 to 79): Mẫu văn bản có phiên bản, Quản trị alone.
  "documents.template.manage": ["admin"],
} as const satisfies Record<string, readonly Role[]>;
