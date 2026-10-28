import { dossierInScope, recordedAction, ruleAllows, ruleFor, type DossierAction, type DossierRef } from "../dossiers/transitions";
import type { Actor } from "../shared/context";
import { forbidden } from "../shared/errors";
import type { Role } from "./roles";
import { dataScopeOf } from "./scope";

/**
 * Policy for the actions of step 1 (spec #1). Rules that depend on a resource's Phạm vi or state
 * (hồ sơ, phiếu chấm) are added beside this table as their modules arrive.
 */
const ROLE_ACTIONS = {
  "user.create": ["admin"],
  "user.list": ["admin"],
  "user.resend_activation": ["admin"],
  "role.grant": ["admin"],
  "role.revoke": ["admin"],
  "audit.search": ["admin"],
  "delivery.list": ["admin"],
  "file.test_upload": ["admin"],
  // Phiên bản tiêu chí (spec #16): only Quản trị writes them or sees drafts.
  "criteria.import": ["admin"],
  "criteria.read_draft": ["admin"],
  "criteria.publish": ["admin"],
  "criteria.preview": ["admin"],
  "criteria.edit": ["admin"],
  "criteria.copy": ["admin"],
  "criteria.delete": ["admin"],
  // Đợt đánh giá (spec #16 story 63): only Cán bộ Sở (Phạm vi tỉnh) creates, opens and changes rounds.
  "round.manage": ["province_officer"],
  // L09 HD-01 (spec #49): Cán bộ Sở records Hội đồng and gán them to đợt; Quản trị reads them to choose a
  // Phạm vi Hội đồng when granting Phân vai, but grants are its only write.
  "council.manage": ["province_officer"],
  "council.read": ["province_officer", "admin"],
  "round.council.assign": ["province_officer"],
  // L09 HD-06 (stories 20, 23): the Cán bộ Sở, or the Thư ký of the Hội đồng gán to the đợt, which
  // changeGradingMode checks; both only until the đợt's first Phiếu chấm.
  "round.grading_mode.change": ["province_officer", "council_secretary"],
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
  // Cấu hình chung toàn hệ thống, such as the mốc nhắc hạn (story 37).
  "system.settings.manage": ["admin"],
  // #82 (stories 70 to 79): Mẫu văn bản có phiên bản, Quản trị alone.
  "documents.template.manage": ["admin"],
  // L16 CT-13, HD-10 (#80): the Nhận xét chung of a hồ sơ Đã chốt điểm; which hồ sơ and until when is the transition table.
  "results.general_comment.write": ["council_chair", "council_secretary"],
  // L16 HD-11 (#83, story 21): ghi nhận and read the Quyết định công nhận of a Phiên họp, the Cán bộ Sở alone.
  "results.decision.record": ["province_officer"],
} as const satisfies Record<string, readonly Role[]>;

/** Actions any signed-in Người dùng may take on their own data, whatever their Vai trò đang dùng. */
const SELF_ACTIONS = [
  "notification.read_own",
  "role.switch_own",
  "totp.enroll_own",
  "password.change_own",
  "reauth.own",
  "criteria.read_published",
  "round.read",
] as const;

export type Action = keyof typeof ROLE_ACTIONS | (typeof SELF_ACTIONS)[number];

type PolicyActor = { kind: "user"; activeRole: Role | null; onBehalfOf?: string } | { kind: "anonymous" | "system" };

/**
 * `can(actor, action)`: whether the Vai trò đang dùng may take an action that has no resource.
 * `can(actor, action, dossier)`: whether it may take this action on this loaded hồ sơ: the transition
 * table has a row for the action from the hồ sơ's state that lists the Vai trò, and the actor's Phạm vi
 * covers the hồ sơ. Guards that depend on time are checked again by transition().
 *
 * An actor doing Nhập hộ (`onBehalfOf`) may take only the `*_on_behalf` variant of an action: a row of
 * ROLE_ACTIONS under that name, or a row of the transition table marked `onBehalf`, and in both cases
 * only as a Cán bộ xã.
 */
export function can(actor: PolicyActor, action: Action): boolean;
export function can(actor: Actor, action: DossierAction, dossier: DossierRef): boolean;
export function can(actor: PolicyActor | Actor, action: Action | DossierAction, dossier?: DossierRef): boolean {
  if (actor.kind !== "user") return false;
  if (dossier) {
    const rule = ruleFor(action as DossierAction, dossier.state);
    return !!rule && ruleAllows(rule, actor) && dossierInScope(dataScopeOf(actor as Actor), dossier);
  }
  if ((SELF_ACTIONS as readonly string[]).includes(action)) return true;
  if (actor.activeRole === null) return false;
  const allowed = ROLE_ACTIONS[recordedAction(action, actor) as keyof typeof ROLE_ACTIONS] as readonly Role[] | undefined;
  return !!allowed && allowed.includes(actor.activeRole);
}

export function authorize(actor: Actor, action: Action): asserts actor is Extract<Actor, { kind: "user" }> {
  if (!can(actor, action)) throw forbidden();
}
