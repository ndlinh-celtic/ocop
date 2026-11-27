import type { Role } from "../identity/roles";

/**
 * Which Vai trò đang dùng may take each action of this module that has no resource, merged by identity/policy.ts. Its
 * actions on one hồ sơ are the transition table of dossiers/transitions.ts. Every row shows in docs/policy-matrix.md.
 */
export const SCORING_PERMISSIONS = {
  // L12 TM-08, TM-09 (#58 stories 65 to 70): sao chép an issued phiên bản into the Phiếu chấm, with its xem trước.
  "scoring.advisory_copy": ["advisory_member"],
  // L14 (story 97): the tiến độ chấm of the Hội đồng's hồ sơ (S42), and bằng chứng kiểm tra of a Phiếu chấm (story 86).
  "scoring.progress.read": ["council_chair", "council_secretary"],
  "scoring.evidence.upload": ["council_member"],
  // L14 (stories 83 to 94): writing one's own Phiếu chấm; which hồ sơ and state is the transition table and DataScope.
  "scoring.sheet.write": ["council_member"],
  // L15 HD-08, HD-09 (#60 stories 107 to 109, 116, 117, 64): Phiên họp of the Hội đồng and chốt điểm; never the Tổ tư vấn.
  "scoring.meeting.manage": ["council_chair", "council_secretary"],
  "scoring.finalize": ["council_chair", "council_secretary"],
  // L15 HD-09, TM-11 (#62 stories 110 to 115): văn bản họp, read by both; the Thư ký uploads the biên bản đã ký.
  "scoring.meeting.document": ["council_chair", "council_secretary"],
  "scoring.meeting.minutes.upload": ["council_secretary"],
  // L15 HD-05 (stories 102 to 106): Trả phiếu before chốt, and the phiếu bị thay thế it leaves behind.
  "scoring.sheet.return": ["council_chair", "council_secretary"],
  // L15 Mở khóa sau chốt (#63 stories 127 to 132): Quản trị alone, on the Hội đồng's văn bản yêu cầu; it reads no
  // hồ sơ or điểm. The Chủ tịch and Thư ký read every kết quả chốt of a hồ sơ, superseded ones too.
  "scoring.unlock": ["admin"],
  "scoring.result.read": ["council_chair", "council_secretary"],
} as const satisfies Record<string, readonly Role[]>;
