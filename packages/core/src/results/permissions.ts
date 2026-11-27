import type { Role } from "../identity/roles";

/**
 * Which Vai trò đang dùng may take each action of this module that has no resource, merged by identity/policy.ts. Its
 * actions on one hồ sơ are the transition table of dossiers/transitions.ts. Every row shows in docs/policy-matrix.md.
 */
export const RESULTS_PERMISSIONS = {
  // L16 CT-13, HD-10 (#80): the Nhận xét chung of a hồ sơ Đã chốt điểm; which hồ sơ and until when is the transition table.
  "results.general_comment.write": ["council_chair", "council_secretary"],
  // L16 HD-11 (#83, story 21): ghi nhận and read the Quyết định công nhận of a Phiên họp, the Cán bộ Sở alone.
  "results.decision.record": ["province_officer"],
  // L17 SO-04 Đề xuất 5 sao (#87): the list, đánh dấu đã gửi, chuyển về, đóng hồ sơ and the Bộ's văn bản.
  "results.five_star.manage": ["province_officer"],
  // L16 HD-11 (#84, stories 26 to 30, 34): the Giấy chứng nhận, listed, downloaded and signed by the Cán bộ Sở alone.
  "results.certificate.manage": ["province_officer"],
  // L16 HD-10 (#85, spec #79 stories 36 to 43): soạn, xem trước and phát hành the Thư kết quả không đạt, the Cán bộ Sở alone.
  "results.result_letter.issue": ["province_officer"],
  // Its PDF (story 66): the Chủ thể of the hồ sơ (the newest phiên bản only) and the Cán bộ Sở; which hồ sơ is the DataScope.
  "results.result_letter.download": ["entity_owner", "province_officer"],
  // L17 SO-04 Gói đề nghị 5 sao (#89, stories 47 to 52): export, list and download the packages.
  "results.package.export": ["province_officer"],
  // L22 DC-05 (#91, spec #79 stories 83, 84): Xuất Excel danh sách sản phẩm đạt sao for the cổng thông tin tỉnh.
  "results.star_list.export": ["province_officer"],
} as const satisfies Record<string, readonly Role[]>;
