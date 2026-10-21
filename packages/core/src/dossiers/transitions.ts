import type { Role } from "../identity/roles";
import type { DataScope } from "../identity/scope";
import { DomainError } from "../shared/errors";
import type { Dossier, DossierState } from "./model";

/**
 * What can happen to a hồ sơ, as data (spec #30 "Vòng đời hồ sơ"). Each row says: from which state,
 * into which state, which Vai trò đang dùng may do it, and an optional guard on the hồ sơ. A same-state
 * row (from = to) is an event that changes the hồ sơ without moving it: editing a Nháp, Tiếp nhận,
 * Cán bộ phụ trách, Chuyển xã. Later tickets add rows and actions here; transition() and can() stay as
 * they are.
 */
export interface TransitionRule {
  action: DossierAction;
  from: DossierState;
  to: DossierState;
  roles: readonly Role[];
  /** The domain event written to the outbox. */
  event: DossierEventType;
  /** A refusal when the hồ sơ, at `now`, does not allow the move; null when it does. */
  guard?: (d: Dossier, now: Date) => DomainError | null;
  /** Whether the move is a row of the timeline (story 34). Autosaving a Nháp is not. */
  timeline: boolean;
  /**
   * L01 Nhập hộ (story 72): a Cán bộ xã may also take it for the Chủ thể, through onBehalfOf(), as the
   * action `<action>_on_behalf`. Such a move is always a row of the timeline (story 74).
   */
  onBehalf?: true;
}

/** What policy needs of a hồ sơ: its state and what decides whose Phạm vi covers it. */
export type DossierRef = Pick<Dossier, "state" | "entityId" | "wardId" | "firstForwardedAt" | "firstProvinceReceivedAt" | "councilId" | "readerAssignment">;

/** Actions on an existing hồ sơ; their audit action is the same string, with `_on_behalf` for Nhập hộ. */
export const DOSSIER_ACTIONS = [
  "dossier.edit",
  "dossier.evidence.add",
  "dossier.evidence.remove",
  "dossier.evidence.link",
  "dossier.self_score",
  "dossier.explain",
  "dossier.delete",
  "dossier.submit",
  "dossier.withdraw",
  "dossier.receive",
  "dossier.handler.change",
  "dossier.supplement.request",
  "dossier.supplement.respond",
  "dossier.resubmit",
  "dossier.supplement.close",
  "dossier.reject",
  "dossier.ward_transfer",
  "dossier.round_transfer",
  "dossier.checklist.assess",
  "dossier.ward_report.attach",
  "dossier.forward",
  "dossier.province_return",
  "dossier.return_request",
  "dossier.province_receive",
  "dossier.assignment.edit",
  "dossier.grading.start_advisory",
  "dossier.grading.start_direct",
  "dossier.advisory_report.edit",
  "dossier.advisory_report.issue",
  "dossier.advisory_report.reissue",
  "dossier.score_sheet.edit",
  "dossier.score_sheet.confirm",
  "dossier.score_sheet.confirm_ready",
  "dossier.assignment.replace",
  "dossier.advisory_return_request",
] as const;
export type DossierAction = (typeof DOSSIER_ACTIONS)[number];

export const DOSSIER_EVENT_TYPES = [
  "dossier.created",
  "dossier.updated",
  "dossier.evidence_added",
  "dossier.evidence_removed",
  "dossier.evidence_linked",
  "dossier.self_scored",
  "dossier.explained",
  "dossier.deleted",
  "dossier.submitted",
  "dossier.withdrawn",
  "dossier.received",
  "dossier.handler_changed",
  "dossier.supplement_requested",
  "dossier.supplement_answered",
  "dossier.resubmitted",
  "dossier.closed_unsupplemented",
  "dossier.rejected_preliminary",
  "dossier.ward_transferred",
  "dossier.round_transferred",
  "dossier.checklist_assessed",
  "dossier.ward_report_attached",
  "dossier.forwarded",
  "dossier.returned_by_province",
  "dossier.return_requested",
  "dossier.province_received",
  "dossier.assignment_changed",
  "dossier.grading_started",
  "dossier.advisory_report_saved",
  "dossier.advisory_report_issued",
  "dossier.score_sheet_saved",
  "dossier.score_sheet_confirmed",
  "dossier.members_confirmed",
  "dossier.advisory_return_requested",
] as const;
export type DossierEventType = (typeof DOSSIER_EVENT_TYPES)[number];

export const TRANSITIONS: readonly TransitionRule[] = [
  // L02 CT-03, CT-05, CT-06: the Chủ thể writes its bản làm việc (thông tin sản phẩm, minh chứng theo
  // tiêu chí, giải trình, tự chấm thử), as a Nháp and again while the xã asks for more (L04 CT-11).
  ...(["draft", "supplement_requested"] as const).flatMap((from) =>
    (
      [
        ["dossier.edit", "dossier.updated"],
        ["dossier.evidence.add", "dossier.evidence_added"],
        ["dossier.evidence.remove", "dossier.evidence_removed"],
        ["dossier.evidence.link", "dossier.evidence_linked"],
        ["dossier.self_score", "dossier.self_scored"],
        ["dossier.explain", "dossier.explained"],
      ] as const
    ).map(([action, event]): TransitionRule => ({ action, from, to: from, roles: ["entity_owner"], event, timeline: false, onBehalf: true })),
  ),
  // Story 26: a Nháp, which by this table has never been submitted, may be deleted.
  { action: "dossier.delete", from: "draft", to: "draft", roles: ["entity_owner"], event: "dossier.deleted", timeline: true },
  // L03 CT-09: nộp into the đợt Đang nhận nộp; the conditions of story 29 are checked by submitDossier.
  { action: "dossier.submit", from: "draft", to: "submitted_to_ward", roles: ["entity_owner"], event: "dossier.submitted", timeline: true, onBehalf: true },
  // Story 33: rút, only while the xã has not Tiếp nhận the hồ sơ.
  {
    action: "dossier.withdraw",
    from: "submitted_to_ward",
    to: "withdrawn",
    roles: ["entity_owner"],
    event: "dossier.withdrawn",
    timeline: true,
    guard: (d) => (d.receivedAt === null ? null : new DomainError("already_received", "Xã đã tiếp nhận hồ sơ nên không rút được nữa")),
  },
  // L05 XA-02 (story 40): Tiếp nhận, once; it names the Cán bộ phụ trách.
  {
    action: "dossier.receive",
    from: "submitted_to_ward",
    to: "submitted_to_ward",
    roles: ["ward_officer"],
    event: "dossier.received",
    timeline: true,
    guard: (d) => (d.receivedAt === null ? null : new DomainError("already_received", "Hồ sơ đã được tiếp nhận")),
  },
  // L05 XA-03 (story 41): another Cán bộ phụ trách, at any time while the xã handles a received hồ sơ.
  ...(["submitted_to_ward", "supplement_requested"] as const).map(
    (from): TransitionRule => ({
      action: "dossier.handler.change",
      from,
      to: from,
      roles: ["ward_officer"],
      event: "dossier.handler_changed",
      timeline: true,
      guard: (d) => (d.receivedAt !== null ? null : new DomainError("not_received", "Hồ sơ chưa được tiếp nhận")),
    }),
  ),
  // L04 XA-05 (story 50): the xã asks for more on a hồ sơ it has Tiếp nhận, with a hạn bổ sung.
  {
    action: "dossier.supplement.request",
    from: "submitted_to_ward",
    to: "supplement_requested",
    roles: ["ward_officer"],
    event: "dossier.supplement_requested",
    timeline: true,
    guard: (d) => (d.receivedAt !== null ? null : new DomainError("not_received", "Hồ sơ chưa được tiếp nhận")),
  },
  // L04 CT-11 (story 51): the Chủ thể answers each nội dung of the yêu cầu bổ sung.
  {
    action: "dossier.supplement.respond",
    from: "supplement_requested",
    to: "supplement_requested",
    roles: ["entity_owner"],
    event: "dossier.supplement_answered",
    timeline: false,
    onBehalf: true,
  },
  // L04 CT-11 (stories 52 to 54): nộp lại while the hạn bổ sung lasts, even after the Hạn nộp xã; the
  // hồ sơ keeps its Tiếp nhận and Cán bộ phụ trách.
  {
    action: "dossier.resubmit",
    from: "supplement_requested",
    to: "submitted_to_ward",
    roles: ["entity_owner"],
    event: "dossier.resubmitted",
    timeline: true,
    onBehalf: true,
    guard: (d, now) => (isPastSupplementDeadline(d, now) ? supplementDeadlinePassed() : null),
  },
  // L04 XA-05 (story 56): once the hạn bổ sung has passed, the xã closes the hồ sơ as Không đạt sơ bộ.
  {
    action: "dossier.supplement.close",
    from: "supplement_requested",
    to: "rejected_preliminary",
    roles: ["ward_officer"],
    event: "dossier.closed_unsupplemented",
    timeline: true,
    guard: (d, now) =>
      isPastSupplementDeadline(d, now) ? null : new DomainError("supplement_deadline_not_passed", "Chưa quá hạn bổ sung nên chưa đóng được hồ sơ"),
  },
  // L05 XA-06 (story 63): the xã loại a hồ sơ Đã nộp xã it has Tiếp nhận, citing an Điều kiện loại or a
  // Lý do loại sơ bộ.
  {
    action: "dossier.reject",
    from: "submitted_to_ward",
    to: "rejected_preliminary",
    roles: ["ward_officer"],
    event: "dossier.rejected_preliminary",
    timeline: true,
    guard: (d) => (d.receivedAt !== null ? null : new DomainError("not_received", "Hồ sơ chưa được tiếp nhận")),
  },
  // L05 (story 47): Chuyển xã moves a hồ sơ Đã nộp xã to the right xã, which Tiếp nhận it afresh.
  { action: "dossier.ward_transfer", from: "submitted_to_ward", to: "submitted_to_ward", roles: ["ward_officer"], event: "dossier.ward_transferred", timeline: true },
  // L06 XA-08 (story 69): chuyển đợt moves a hồ sơ Đã nộp xã into a later đợt of the same Phiên bản tiêu
  // chí; which đợt may take it is checked by transferRound, which knows the đợt.
  { action: "dossier.round_transfer", from: "submitted_to_ward", to: "submitted_to_ward", roles: ["ward_officer"], event: "dossier.round_transferred", timeline: true },
  // L06 XA-04 (story 61): the Checklist sơ bộ of a received hồ sơ, editable until it is gửi tỉnh. Nhận xét
  // are the xã's working notes, so this is not a row of the timeline the Chủ thể reads.
  ...(["submitted_to_ward", "supplement_requested"] as const).map(
    (from): TransitionRule => ({
      action: "dossier.checklist.assess",
      from,
      to: from,
      roles: ["ward_officer"],
      event: "dossier.checklist_assessed",
      timeline: false,
      guard: (d) => (d.receivedAt !== null ? null : new DomainError("not_received", "Hồ sơ chưa được tiếp nhận")),
    }),
  ),
  // L06 XA-07 (story 65): the signed Báo cáo đánh giá cấp xã of a received hồ sơ, uploaded before gửi tỉnh.
  {
    action: "dossier.ward_report.attach",
    from: "submitted_to_ward",
    to: "submitted_to_ward",
    roles: ["ward_officer"],
    event: "dossier.ward_report_attached",
    timeline: false,
    guard: (d) => (d.receivedAt !== null ? null : new DomainError("not_received", "Hồ sơ chưa được tiếp nhận")),
  },
  // L06 XA-07 (stories 66, 67): gửi tỉnh; the signed report, the Checklist sơ bộ and Hạn gửi tỉnh are
  // checked by forwardToProvince, which knows the đợt.
  {
    action: "dossier.forward",
    from: "submitted_to_ward",
    to: "forwarded_to_province",
    roles: ["ward_officer"],
    event: "dossier.forwarded",
    timeline: true,
    guard: (d) => (d.receivedAt !== null ? null : new DomainError("not_received", "Hồ sơ chưa được tiếp nhận")),
  },
  // L04 (story 57): the Sở trả về a hồ sơ Đã chuyển tỉnh as a yêu cầu bổ sung of its own, so the Chủ thể
  // answers one list; the nộp lại brings it back to Đã nộp xã for the xã to review (story 58). L10 TM-03
  // (#57 stories 52, 55): also while the Tổ tư vấn thẩm định it, never once Phiếu chấm are being written.
  ...(["forwarded_to_province", "advisory_review"] as const).map(
    (from): TransitionRule => ({
      action: "dossier.province_return",
      from,
      to: "supplement_requested",
      roles: ["province_officer"],
      event: "dossier.returned_by_province",
      timeline: true,
    }),
  ),
  // L04 (story 59): the xã asks the Sở to trả về a hồ sơ it has gửi tỉnh. The state stays; it is a matter
  // between the xã and the Sở, so not a row of the timeline the Chủ thể reads.
  {
    action: "dossier.return_request",
    from: "forwarded_to_province",
    to: "forwarded_to_province",
    roles: ["ward_officer"],
    event: "dossier.return_requested",
    timeline: false,
  },
  // L08 SO-02 (stories 15, 16, 137): Tiếp nhận tại tỉnh, once per lượt gửi tỉnh; a Sở trả về clears it
  // (returnFromProvince), so the hồ sơ is Tiếp nhận again when it is back. That the đợt has a Hội đồng is
  // checked by receiveAtProvince, which knows the đợt.
  {
    action: "dossier.province_receive",
    from: "forwarded_to_province",
    to: "forwarded_to_province",
    roles: ["province_officer"],
    event: "dossier.province_received",
    timeline: true,
    guard: (d) =>
      d.provinceReceivedAt === null ? null : new DomainError("already_province_received", "Hồ sơ đã được tiếp nhận tại tỉnh trong lượt gửi tỉnh này"),
  },
  // L09 HD-02 (stories 25 to 29): the Thư ký writes the Phân công nháp of a hồ sơ Tiếp nhận tại tỉnh in this
  // lượt; who may be chosen is checked by editAssignments, which knows the Hội đồng. Not on the timeline the
  // Chủ thể reads (story 137).
  {
    action: "dossier.assignment.edit",
    from: "forwarded_to_province",
    to: "forwarded_to_province",
    roles: ["council_secretary"],
    event: "dossier.assignment_changed",
    timeline: false,
    guard: provinceReceived,
  },
  // L09 HD-06 (stories 30 to 33): Giao chấm, into Tổ tư vấn thẩm định or Thành viên xem xét by the Chế độ chấm
  // of the đợt at that moment; startGrading picks the row and checks the Phân công, which it knows. Two
  // actions because ruleFor looks a row up by action and state. A row of the Chủ thể's timeline (story 137).
  ...(
    [
      ["dossier.grading.start_advisory", "advisory_review"],
      ["dossier.grading.start_direct", "member_review"],
    ] as const
  ).map(
    ([action, to]): TransitionRule => ({
      action,
      from: "forwarded_to_province",
      to,
      roles: ["council_secretary"],
      event: "dossier.grading_started",
      timeline: true,
      guard: provinceReceived,
    }),
  ),
  // L10 TM-02, TM-05, TM-06 (stories 44 to 50): the Tổ tư vấn Phân công write their shared nháp. Off the timeline.
  { action: "dossier.advisory_report.edit", from: "advisory_review", to: "advisory_review", roles: ["advisory_member"], event: "dossier.advisory_report_saved", timeline: false },
  // L10 TM-03 (#57 story 51): a Thành viên Tổ tư vấn Phân công asks the Sở to trả về; the state stays. A matter
  // between the Tổ tư vấn and the Sở, so not on the timeline the Chủ thể reads (story 53).
  {
    action: "dossier.advisory_return_request",
    from: "advisory_review",
    to: "advisory_review",
    roles: ["advisory_member"],
    event: "dossier.advisory_return_requested",
    timeline: false,
  },
  // L11 TM-07 (stories 56 to 59): phát hành phiên bản 1; that the actor is the Tổ trưởng is checked by issueAdvisoryReport.
  { action: "dossier.advisory_report.issue", from: "advisory_review", to: "advisory_report_issued", roles: ["advisory_member"], event: "dossier.advisory_report_issued", timeline: true },
  // L11 (stories 60, 61): phiên bản N+1 until Đã chốt điểm, which has no row.
  ...(["advisory_report_issued", "member_review", "member_confirmed"] as const).map(
    (from): TransitionRule => ({ action: "dossier.advisory_report.reissue", from, to: from, roles: ["advisory_member"], event: "dossier.advisory_report_issued", timeline: true }),
  ),
  // L14 TV-01, TV-05..07 (stories 83 to 94): a thành viên chấm writes and xác nhận their own Phiếu chấm while
  // the hồ sơ is Thành viên xem xét or Sẵn sàng chốt; the use case finds the phiếu by the reader's Phân công.
  // The xác nhận that brings the phiếu đã xác nhận to người chấm tối thiểu is its own action because ruleFor
  // looks a row up by action and state. None is a row of the Chủ thể's timeline (spec #49).
  ...(["member_review", "member_confirmed"] as const).flatMap((from) =>
    (
      [
        ["dossier.score_sheet.edit", "dossier.score_sheet_saved"],
        ["dossier.score_sheet.confirm", "dossier.score_sheet_confirmed"],
      ] as const
    ).map(([action, event]): TransitionRule => ({ action, from, to: from, roles: ["council_member"], event, timeline: false })),
  ),
  {
    action: "dossier.score_sheet.confirm_ready",
    from: "member_review",
    to: "member_confirmed",
    roles: ["council_member"],
    event: "dossier.members_confirmed",
    timeline: false,
  },
  // L09 HD-03 (stories 34 to 39): after Giao chấm and before chốt điểm, the Thư ký thay or bổ sung a thành viên
  // chấm or Thành viên Tổ tư vấn, with a reason; replaceAssignment/addAssignment check the Phân công and phiếu.
  ...(["advisory_review", "advisory_report_issued", "member_review", "member_confirmed"] as const).map(
    (from): TransitionRule => ({ action: "dossier.assignment.replace", from, to: from, roles: ["council_secretary"], event: "dossier.assignment_changed", timeline: false }),
  ),
];

/** Guard of the Hội đồng rows: Tiếp nhận tại tỉnh in the current lượt gửi tỉnh. */
function provinceReceived(d: Dossier): DomainError | null {
  return d.provinceReceivedAt !== null ? null : new DomainError("not_province_received", "Hồ sơ chưa được tiếp nhận tại tỉnh trong lượt gửi tỉnh này");
}

/** Whether the hạn bổ sung is over at `now`; its last second still counts, like the Hạn nộp xã. */
export const isPastSupplementDeadline = (d: Pick<Dossier, "supplementDeadline">, now: Date) =>
  d.supplementDeadline !== null && now.getTime() > d.supplementDeadline.getTime();

export const supplementDeadlinePassed = () => new DomainError("supplement_deadline_passed", "Đã quá hạn bổ sung nên không nộp lại được");

/**
 * Whether the actor's Vai trò đang dùng may take a row: one of its `roles`, or, under Nhập hộ, a row
 * marked `onBehalf` and only as a Cán bộ xã.
 */
export function ruleAllows(rule: TransitionRule, actor: { activeRole: Role | null; onBehalfOf?: string }): boolean {
  if (!actor.activeRole) return false;
  return actor.onBehalfOf !== undefined ? rule.onBehalf === true && actor.activeRole === "ward_officer" : rule.roles.includes(actor.activeRole);
}

/** The audit and timeline action of a move: `<action>_on_behalf` under Nhập hộ (story 73). */
export const recordedAction = (action: string, actor: { onBehalfOf?: string }) => (actor.onBehalfOf !== undefined ? `${action}_on_behalf` : action);

/** The rule for `action` from the hồ sơ's current state, if the table has one. */
export const ruleFor = (action: DossierAction, state: DossierState) => TRANSITIONS.find((r) => r.action === action && r.from === state);

/**
 * Whether a DataScope covers a loaded hồ sơ: the same rule the repository writes as SQL, applied to a row
 * already in hand. The switch is exhaustive, so a new DataScope branch must decide here too.
 */
export function dossierInScope(scope: DataScope, d: DossierRef): boolean {
  switch (scope.kind) {
    case "entity":
      return d.entityId === scope.entityId;
    case "ward":
      // The xã the hồ sơ was submitted to (or moved to by Chuyển xã); a Nháp belongs to no xã yet.
      return d.wardId === scope.wardId;
    case "province":
      // From the first gửi tỉnh on, even after the Sở trả về it (story 78).
      return d.firstForwardedAt !== null;
    case "on_behalf":
      // The hồ sơ of the Chủ thể with no xã yet (a Nháp) or at the officer's xã (story 49). The Chủ thể's
      // xã đăng ký is not on the hồ sơ: the repository checks it when it loads the row, and a row in hand
      // was loaded within this scope.
      return d.entityId === scope.entityId && (d.wardId === null || d.wardId === scope.wardId);
    case "council":
      // The đợt is the Hội đồng's, and the hồ sơ has been Tiếp nhận tại tỉnh at least once (story 24).
      return d.councilId === scope.councilId && d.firstProvinceReceivedAt !== null;
    case "assigned":
      // The reader's own Phân công in force, of the kind of their Vai trò, loaded with the row (stories 41, 79).
      return d.councilId === scope.councilId && d.readerAssignment === scope.as;
    case "none":
      return false;
    default: {
      const unhandled: never = scope;
      throw new Error(`unhandled data scope ${JSON.stringify(unhandled)}`);
    }
  }
}
