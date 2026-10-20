import type { Actor } from "../shared/context";

/**
 * The business data a Người dùng may see through their Vai trò đang dùng (#14, spec #30). Repositories of
 * Chủ thể and hồ sơ take it as a mandatory argument on every read and turn it into a WHERE clause, so an
 * out-of-scope row is never loaded; to the caller it does not exist.
 *
 * Branches arrive with the modules that need them: `ward` (Cán bộ xã) and `province` (Cán bộ Sở, only what
 * has reached the province) in step 3, `council` and `assigned` in step 4. Adding one is a new member here,
 * a new case in `dataScopeOf`, and a new case in each repository's exhaustive switch: nothing is restructured.
 */
export type DataScope =
  | { kind: "entity"; entityId: string }
  | { kind: "ward"; wardId: string }
  /** Cán bộ Sở: the hồ sơ that have ever reached Đã chuyển tỉnh, and the Chủ thể of those (story 78). */
  | { kind: "province" }
  | { kind: "none" };

const NONE: DataScope = { kind: "none" };

/**
 * Pure: derives the DataScope from the actor's active Phân vai only, never from any other Phân vai the
 * Người dùng holds, so switching Vai trò never mixes data (story 82). A Vai trò without a branch yet, and
 * Quản trị by design (story 83), sees nothing.
 */
export function dataScopeOf(actor: Actor): DataScope {
  if (actor.kind !== "user" || !actor.activeRole || !actor.activeScope) return NONE;
  const { type, id } = actor.activeScope;
  switch (actor.activeRole) {
    case "entity_owner":
      return type === "entity" && id ? { kind: "entity", entityId: id } : NONE;
    case "ward_officer":
      return type === "ward" && id ? { kind: "ward", wardId: id } : NONE;
    case "province_officer":
      return type === "province" ? { kind: "province" } : NONE;
    default:
      return NONE;
  }
}
