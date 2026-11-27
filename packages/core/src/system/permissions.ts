import type { Role } from "../identity/roles";

/**
 * Which Vai trò đang dùng may take each action of this module that has no resource, merged by identity/policy.ts. Its
 * actions on one hồ sơ are the transition table of dossiers/transitions.ts. Every row shows in docs/policy-matrix.md.
 */
export const SYSTEM_PERMISSIONS = {
  // Cấu hình chung toàn hệ thống, such as the mốc nhắc hạn (story 37).
  "system.settings.manage": ["admin"],
} as const satisfies Record<string, readonly Role[]>;
