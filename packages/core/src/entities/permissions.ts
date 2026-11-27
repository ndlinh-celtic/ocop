import type { Role } from "../identity/roles";

/**
 * Which Vai trò đang dùng may take each action of this module that has no resource, merged by identity/policy.ts. Its
 * actions on one hồ sơ are the transition table of dossiers/transitions.ts. Every row shows in docs/policy-matrix.md.
 */
export const ENTITIES_PERMISSIONS = {
  // Chủ thể (spec #30): who may read them at all; which ones is the DataScope of identity/scope.ts.
  "entity.read": ["entity_owner", "ward_officer", "province_officer", "council_member"],
  // The Chủ thể keeps its own organisation details and giấy tờ pháp lý (L01 CT-02).
  "entity.update": ["entity_owner"],
  "entity.legal_document.manage": ["entity_owner"],
  // The full số định danh cá nhân, audited as a personal data access (story 13).
  "entity.personal_id.reveal": ["entity_owner", "ward_officer"],
  // L01 (stories 11, 12): a Cán bộ xã creates a Chủ thể of their xã and changes its Người dùng đại diện's email.
  "entity.create": ["ward_officer"],
  "entity.representative_email.change": ["ward_officer"],
} as const satisfies Record<string, readonly Role[]>;
