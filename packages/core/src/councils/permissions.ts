import type { Role } from "../identity/roles";

/**
 * Which Vai trò đang dùng may take each action of this module that has no resource, merged by identity/policy.ts. Its
 * actions on one hồ sơ are the transition table of dossiers/transitions.ts. Every row shows in docs/policy-matrix.md.
 */
export const COUNCILS_PERMISSIONS = {
  // L09 HD-01 (spec #49): Cán bộ Sở records Hội đồng and gán them to đợt; Quản trị reads them to choose a
  // Phạm vi Hội đồng when granting Phân vai, but grants are its only write.
  "council.manage": ["province_officer"],
  "council.read": ["province_officer", "admin"],
} as const satisfies Record<string, readonly Role[]>;
