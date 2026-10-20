/** The eight fixed Vai trò (GLOSSARY.md); not configurable by Quản trị. */
export const ROLES = [
  "entity_owner", // Chủ thể
  "ward_officer", // Cán bộ xã
  "province_officer", // Cán bộ Sở
  "council_chair", // Chủ tịch hội đồng
  "council_secretary", // Thư ký hội đồng
  "council_member", // Thành viên hội đồng
  "advisory_member", // Thành viên Tổ tư vấn
  "admin", // Quản trị
] as const;
export type Role = (typeof ROLES)[number];

/** Loại Phạm vi. */
export const SCOPE_TYPES = ["entity", "ward", "province", "council", "system"] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

/** Each Vai trò takes exactly one kind of Phạm vi. */
export const SCOPE_OF_ROLE: Record<Role, ScopeType> = {
  entity_owner: "entity",
  ward_officer: "ward",
  province_officer: "province",
  council_chair: "council",
  council_secretary: "council",
  council_member: "council",
  advisory_member: "council",
  admin: "system",
};

export const ROLE_LABEL: Record<Role, string> = {
  entity_owner: "Chủ thể",
  ward_officer: "Cán bộ xã",
  province_officer: "Cán bộ Sở",
  council_chair: "Chủ tịch hội đồng",
  council_secretary: "Thư ký hội đồng",
  council_member: "Thành viên hội đồng",
  advisory_member: "Thành viên Tổ tư vấn",
  admin: "Quản trị",
};

/** Vai trò for which TOTP is optional; every other Vai trò must use it unless the deployment opts out. */
export const TOTP_OPTIONAL_ROLES: readonly Role[] = ["entity_owner", "ward_officer"];
