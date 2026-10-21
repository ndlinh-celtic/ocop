import type { AssignmentKind } from "../councils/assignment-model";
import type { Actor } from "../shared/context";

/**
 * The business data a Người dùng may see through their Vai trò đang dùng (#14, spec #30). The reads that
 * load a Chủ thể or a hồ sơ (by id or as a list) take it as a mandatory argument and turn it into a WHERE
 * clause, so an out-of-scope row is never loaded; to the caller it does not exist. Reads of what belongs
 * to a hồ sơ (its timeline, Phiên bản nộp, minh chứng, yêu cầu bổ sung…) go by dossierId without a scope:
 * they rely on the use case having loaded that hồ sơ through a scoped lookup first.
 *
 * Branches arrive with the modules that need them: `ward` (Cán bộ xã) and `province` (Cán bộ Sở, only what
 * has reached the province) in step 3, `council` (Chủ tịch, Thư ký) and `assigned` (Thành viên, Tổ tư vấn) in step 4. Adding one is a new member here,
 * a new case in `dataScopeOf`, and a new case in each repository's exhaustive switch: nothing is restructured.
 */
export type DataScope =
  | { kind: "entity"; entityId: string }
  | { kind: "ward"; wardId: string }
  /** Cán bộ Sở: the hồ sơ that have ever reached Đã chuyển tỉnh, and the Chủ thể of those (story 78). */
  | { kind: "province" }
  /**
   * Nhập hộ: one Chủ thể, and only while it is đăng ký ở xã `wardId` (story 75); of its hồ sơ, a Nháp
   * (no xã yet) or one whose xã is `wardId`, so a hồ sơ Chuyển xã elsewhere is out (story 49).
   */
  | { kind: "on_behalf"; entityId: string; wardId: string }
  /**
   * Chủ tịch, Thư ký hội đồng (spec #49 story 24): the hồ sơ of the đợt gán to Hội đồng `councilId`, from
   * their first Tiếp nhận tại tỉnh on, even after a Sở trả về.
   */
  | { kind: "council"; councilId: string }
  /**
   * Thành viên hội đồng (`as: "member"`), Thành viên Tổ tư vấn (`as: "advisory"`): the hồ sơ of a đợt of
   * Hội đồng `councilId` on which `userId` has a Phân công of that kind in force (Giao chấm given, not
   * replaced). A Phân công nháp shows nothing (stories 41, 79).
   */
  | { kind: "assigned"; userId: string; councilId: string; as: AssignmentKind }
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
  if (actor.onBehalfOf !== undefined) {
    // Only a Cán bộ xã acts for a Chủ thể, and only for one đăng ký ở their xã: the repositories check
    // the xã đăng ký in SQL, so a Chủ thể of another xã, even with a hồ sơ moved here, is not found.
    return actor.activeRole === "ward_officer" && type === "ward" && id ? { kind: "on_behalf", entityId: actor.onBehalfOf, wardId: id } : NONE;
  }
  switch (actor.activeRole) {
    case "entity_owner":
      return type === "entity" && id ? { kind: "entity", entityId: id } : NONE;
    case "ward_officer":
      return type === "ward" && id ? { kind: "ward", wardId: id } : NONE;
    case "province_officer":
      return type === "province" ? { kind: "province" } : NONE;
    case "council_chair":
    case "council_secretary":
      return type === "council" && id ? { kind: "council", councilId: id } : NONE;
    case "council_member":
      return type === "council" && id ? { kind: "assigned", userId: actor.userId, councilId: id, as: "member" } : NONE;
    case "advisory_member":
      return type === "council" && id ? { kind: "assigned", userId: actor.userId, councilId: id, as: "advisory" } : NONE;
    default:
      return NONE;
  }
}
