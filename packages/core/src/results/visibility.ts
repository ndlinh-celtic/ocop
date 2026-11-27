import type { Dossier } from "../dossiers/model";
import type { Role } from "../identity/roles";

/**
 * Who reads the Nhận xét chung of a hồ sơ (#80, GLOSSARY.md "Quan hệ"): the Hội đồng and the Sở from chốt, the Chủ thể only
 * from Công bố kết quả, the Cán bộ xã (Nhập hộ included) and Quản trị never.
 */
export function generalCommentVisible(role: Role | null, d: Pick<Dossier, "resultPublishedAt">): boolean {
  switch (role) {
    case "council_chair":
    case "council_secretary":
    case "council_member":
    case "advisory_member":
    case "province_officer":
      return true;
    case "entity_owner":
      return d.resultPublishedAt !== null;
    default:
      return false;
  }
}
