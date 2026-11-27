import type { Role } from "../identity/roles";

/**
 * Which Vai trò đang dùng may take each action of this module that has no resource, merged by identity/policy.ts. Its
 * actions on one hồ sơ are the transition table of dossiers/transitions.ts. Every row shows in docs/policy-matrix.md.
 */
export const ROUNDS_PERMISSIONS = {
  // Đợt đánh giá (spec #16 story 63): only Cán bộ Sở (Phạm vi tỉnh) creates, opens and changes rounds.
  "round.manage": ["province_officer"],
  "round.council.assign": ["province_officer"],
  // L09 HD-06 (stories 20, 23): the Cán bộ Sở, or the Thư ký of the Hội đồng gán to the đợt, which
  // changeGradingMode checks; both only until the đợt's first Phiếu chấm.
  "round.grading_mode.change": ["province_officer", "council_secretary"],
} as const satisfies Record<string, readonly Role[]>;
