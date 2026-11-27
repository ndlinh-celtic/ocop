import type { Role } from "../identity/roles";

/**
 * Which Vai trò đang dùng may take each action of this module that has no resource, merged by identity/policy.ts. Its
 * actions on one hồ sơ are the transition table of dossiers/transitions.ts. Every row shows in docs/policy-matrix.md.
 */
export const DOSSIERS_PERMISSIONS = {
  // Hồ sơ (spec #30): who may read or start them at all. What may be done to one hồ sơ is the transition
  // table of dossiers/transitions.ts, checked by can(actor, action, dossier).
  // Step 4 adds the Vai trò hội đồng; their DataScope `council` / `assigned` decides which (spec #49).
  "dossier.read": ["entity_owner", "ward_officer", "province_officer", "council_chair", "council_secretary", "council_member", "advisory_member"],
  "dossier.create": ["entity_owner"],
  // Any change to an existing hồ sơ starts here: the Vai trò that work on hồ sơ at all. Which change, on
  // which hồ sơ, is then the transition table's row and the Phạm vi, checked by transition().
  "dossier.write": ["entity_owner", "ward_officer", "province_officer", "council_secretary"],
  // L09 HD-02 (stories 24 to 29): the Phân công of a hồ sơ of the Hội đồng, and the members to choose from.
  "dossier.assignment.read": ["council_chair", "council_secretary"],
  // L10, L11 (#56 stories 49, 63): the Báo cáo Tổ tư vấn nháp is the Tổ tư vấn's alone; its issued phiên bản,
  // and the minh chứng and tệp đính kèm they cite, are for every Vai trò hội đồng whose Phạm vi covers the hồ sơ.
  "dossier.advisory_report.draft": ["advisory_member"],
  "dossier.advisory_report.write": ["advisory_member"],
  "dossier.advisory_report.read": ["council_chair", "council_secretary", "council_member", "advisory_member"],
  "dossier.advisory_report.upload": ["advisory_member"],
  // Story 79: counts by xã and state of the hồ sơ not yet at the province, never their rows.
  "dossier.overview": ["province_officer"],
  // Story 59: the đề nghị trả về between the xã and the Sở; the Chủ thể does not read them.
  "dossier.return_request.read": ["ward_officer", "province_officer"],
  // L10 TM-03 (#57 stories 52, 53): the đề nghị trả về of the Tổ tư vấn, for the Sở and the Tổ tư vấn of the
  // hồ sơ (DataScope `assigned`); neither the xã nor the Chủ thể reads them. Sending one is gated by
  // dossier.advisory_report.write, the Tổ tư vấn's write on a hồ sơ, then by the transition table.
  "dossier.advisory_return_request.read": ["province_officer", "advisory_member"],
  "dossier.evidence.upload": ["entity_owner"],
  // L05 XA-02: the Cán bộ xã of their own xã, to choose a Cán bộ phụ trách from.
  "dossier.handler.list": ["ward_officer"],
  // #37: the Phiếu đăng ký and Báo cáo tự đánh giá of a Phiên bản nộp, for whoever's Phạm vi covers the hồ sơ.
  "dossier.document.download": ["entity_owner", "ward_officer", "province_officer", "council_chair", "council_secretary", "council_member", "advisory_member"],
  // L06 XA-07 (#42): the Cán bộ xã generates the Báo cáo đánh giá cấp xã and uploads its signed PDF.
  "dossier.ward_report.generate": ["ward_officer"],
  "dossier.ward_report.upload": ["ward_officer"],
  // L01 Nhập hộ (stories 72 to 75): what a Cán bộ xã may do for a Chủ thể đăng ký ở xã mình, through
  // onBehalfOf(). The actions on one hồ sơ are the transition table's rows marked `onBehalf`.
  "dossier.read_on_behalf": ["ward_officer"],
  "dossier.write_on_behalf": ["ward_officer"],
  "dossier.create_on_behalf": ["ward_officer"],
  "dossier.evidence.upload_on_behalf": ["ward_officer"],
  "dossier.document.download_on_behalf": ["ward_officer"],
  // L22 DC-05 (#90, spec #79 stories 80 to 84): Xuất Excel danh sách hồ sơ; which hồ sơ is the exporter's DataScope.
  "dossier.export": ["ward_officer", "province_officer", "council_chair", "council_secretary"],
} as const satisfies Record<string, readonly Role[]>;
