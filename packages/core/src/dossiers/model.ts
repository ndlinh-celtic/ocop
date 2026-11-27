import type { AssignmentKind } from "../councils/assignment-model";
import type { EntityKind } from "../entities/model";
import type { FileStatus } from "../files/model";
import type { DataScope } from "../identity/scope";
import { DomainError } from "../shared/errors";

/**
 * The 15 states of a hồ sơ: the 14 of the luồng xử lý (mục 1.2) plus Đã rút (ADR 0007). Which moves
 * between them exist is the transition table in `transitions.ts`, not this list.
 */
export const DOSSIER_STATES = [
  "draft",
  "submitted_to_ward",
  "supplement_requested",
  "rejected_preliminary",
  "withdrawn",
  "forwarded_to_province",
  "advisory_review",
  "advisory_report_issued",
  "member_review",
  "member_confirmed",
  "score_finalized",
  "recognized",
  "not_passed",
  "five_star_proposed",
  "closed_offline",
] as const;
export type DossierState = (typeof DOSSIER_STATES)[number];

export const DOSSIER_STATE_LABEL: Record<DossierState, string> = {
  draft: "Nháp",
  submitted_to_ward: "Đã nộp xã",
  supplement_requested: "Yêu cầu bổ sung",
  rejected_preliminary: "Không đạt sơ bộ",
  withdrawn: "Đã rút",
  forwarded_to_province: "Đã chuyển tỉnh",
  advisory_review: "Tổ tư vấn thẩm định",
  advisory_report_issued: "Đã phát hành báo cáo Tổ tư vấn",
  member_review: "Thành viên xem xét",
  member_confirmed: "Thành viên xác nhận",
  score_finalized: "Đã chốt điểm",
  recognized: "Công nhận 3/4 sao",
  not_passed: "Không đạt",
  five_star_proposed: "Đã gửi đề nghị 5 sao",
  closed_offline: "Đã đóng, xử lý ngoài hệ thống",
};

/**
 * The states in which a hồ sơ needs nothing more within its đợt (L07 step 5: "trạng thái cuối hoặc đã
 * chốt"): it left the flow (Không đạt sơ bộ, Đã rút), or the hội đồng has chốt điểm and what follows is
 * the result. Đã chuyển tỉnh and every state before chốt điểm are unfinished, so the đợt cannot end.
 */
export const FINISHED_STATES: readonly DossierState[] = [
  "rejected_preliminary",
  "withdrawn",
  "score_finalized",
  "recognized",
  "not_passed",
  "five_star_proposed",
  "closed_offline",
];

/** Thông tin sản phẩm (story 18). Free text while writing; which fields are required is checked on submission. */
export const PRODUCT_FIELDS = ["productName", "description", "ingredients", "process", "packaging", "qualityDeclaration"] as const;
export type ProductField = (typeof PRODUCT_FIELDS)[number];
export type ProductInfo = Record<ProductField, string>;

export const EMPTY_PRODUCT: ProductInfo = { productName: "", description: "", ingredients: "", process: "", packaging: "", qualityDeclaration: "" };

/** Hồ sơ: one request to evaluate one product against exactly one Bộ tiêu chí (GLOSSARY.md). */
export interface Dossier extends ProductInfo {
  id: string;
  entityId: string;
  /** Fixed from creation (ADR 0006); the DB refuses to change them. */
  criteriaSetId: string;
  criteriaVersionId: string;
  state: DossierState;
  /** The xã it was submitted to; changes only through Chuyển xã. Null until submitted. */
  wardId: string | null;
  /** The đợt it was submitted into. Null until submitted. */
  roundId: string | null;
  receivedAt: Date | null;
  receivedBy: string | null;
  handlerUserId: string | null;
  /** When it first reached Đã chuyển tỉnh: from then on the province sees it (story 78). */
  firstForwardedAt: Date | null;
  /** Mã hồ sơ, HS-<năm>-<số>, given at creation and never changed (story 19, SO-03; ADR 0004). */
  code: string;
  /** L08 SO-02: the Tiếp nhận tại tỉnh of the current lượt gửi tỉnh; null again after every Sở trả về. */
  provinceReceivedAt: Date | null;
  provinceReceivedBy: string | null;
  /** The first Tiếp nhận tại tỉnh ever; never reset, so the Hội đồng keeps seeing the hồ sơ (spec #49). */
  firstProvinceReceivedAt: Date | null;
  /** L09 HD-06: when Giao chấm put the hồ sơ into Tổ tư vấn thẩm định or Thành viên xem xét; null again after a Sở trả về. */
  gradingStartedAt: Date | null;
  /**
   * Derived when loaded, never written: the Hội đồng gán to the hồ sơ's đợt, and the kind of the reader's
   * own Phân công in force on it (null unless the reader's DataScope is `assigned`). The DataScope checks of
   * policy read them (spec #49 "DataScope và policy").
   */
  councilId: string | null;
  readerAssignment: AssignmentKind | null;
  /** Hạn bổ sung of the open yêu cầu bổ sung: set exactly while the hồ sơ is Yêu cầu bổ sung (#39). */
  supplementDeadline: Date | null;
  copiedFrom: string | null;
  deletedAt: Date | null;
  /**
   * L16 Công bố kết quả (spec #79): set once, when a Quyết định công nhận naming the hồ sơ is recorded or its first Thư kết
   * quả không đạt is issued; never reset (the DB refuses it). Mở khóa sau chốt and Nhận xét chung stop there.
   */
  resultPublishedAt: Date | null;
  /** L16 CT-13, HD-10 (#80): the Nhận xét chung of the Chủ tịch or Thư ký, outside the snapshot chốt; null until written. */
  generalComment: string | null;
  generalCommentUpdatedAt: Date | null;
  generalCommentUpdatedBy: string | null;
  /**
   * L17 (#87, ADR 0009): the Sở chuyển về công nhận cấp tỉnh a hồ sơ Đã gửi đề nghị 5 sao on the Bộ's văn bản
   * (`ministryReturnFileId`); it then waits, still Đã gửi đề nghị 5 sao, for a Quyết định công nhận bổ sung.
   */
  awaitingSupplementaryDecision: boolean;
  ministryReturnFileId: string | null;
  /** Optimistic lock: every change goes through transition() and bumps it by one. */
  version: number;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

/** One row of the timeline: a transition, or a same-state event such as Tiếp nhận (from = to). */
export interface DossierEvent {
  id: string;
  dossierId: string;
  action: string;
  /** Null for the creation of the hồ sơ. */
  fromState: DossierState | null;
  toState: DossierState;
  actorUserId: string | null;
  actorRole: string | null;
  occurredAt: Date;
  reason: string | null;
  metadata: Record<string, unknown>;
}

export interface EvidenceFile {
  fileId: string;
  fileName: string;
  status: FileStatus;
  addedAt: Date;
}

/** Narrows a list of hồ sơ; every field given must hold. */
export interface DossierListFilter {
  state?: DossierState;
  /** Đã nộp xã and not yet Tiếp nhận: "Chờ tiếp nhận" (story 39). */
  awaitingReceipt?: boolean;
  /** Đã chuyển tỉnh and not yet Tiếp nhận tại tỉnh in this lượt gửi tỉnh: "Chờ tiếp nhận" of the Sở (#51 story 13). */
  awaitingProvinceReceipt?: boolean;
  roundId?: string;
  wardId?: string;
  /** The Nhóm sản phẩm of the hồ sơ's Bộ tiêu chí. */
  productGroupId?: string;
  handlerUserId?: string;
  /** Tổ tư vấn thẩm định with a đề nghị trả về of the Tổ tư vấn since its Giao chấm (#57 story 52). */
  advisoryReturnRequested?: boolean;
  /** Chờ đợt sau at this instant: Đã nộp xã, and the Hạn gửi tỉnh of its đợt is before it (story 68). */
  awaitingNextRoundAt?: Date;
}

/**
 * Story 68: "Chờ đợt sau" is derived, not a state. A hồ sơ still Đã nộp xã once the Hạn gửi tỉnh of its
 * đợt has passed can no longer be gửi tỉnh in that đợt; it stays at the xã until chuyển đợt (XA-08).
 * The last second of the Hạn gửi tỉnh still counts, as it does for gửi tỉnh.
 */
export const isAwaitingNextRound = (d: Pick<Dossier, "state">, round: { forwardingDeadline: Date } | null, now: Date) =>
  d.state === "submitted_to_ward" && round !== null && now > round.forwardingDeadline;

/** What the narrow lookup of DossierRepo.stateRow loads: the mã and state, and what a transition records. */
export type DossierStateRow = Pick<Dossier, "id" | "code" | "state" | "version" | "entityId" | "resultPublishedAt">;

/**
 * Every read takes the reader's DataScope and filters in SQL (#14); a deleted Nháp is never returned.
 * Out-of-scope rows come back as absent.
 */
export interface DossierRepo {
  insert(d: Dossier): Promise<void>;
  /** The next số of the mã hồ sơ in `year`, 1 for the first; taken in the caller's transaction. */
  nextCodeNumber(year: number): Promise<number>;
  findById(scope: DataScope, id: string): Promise<Dossier | null>;
  /** findById with the row locked FOR UPDATE until the transaction ends. */
  lock(scope: DataScope, id: string): Promise<Dossier | null>;
  /** Writes every mutable field, only while the stored version is still `expectedVersion`; false otherwise. */
  update(d: Dossier, expectedVersion: number): Promise<boolean>;
  /**
   * The narrow lookup of a Vai trò with no DataScope over hồ sơ (Mở khóa sau chốt, spec #49): by id or mã, no Phạm vi
   * and nothing of the hồ sơ's content; locked FOR UPDATE when `lock`.
   */
  stateRow(by: { id: string } | { code: string }, lock?: boolean): Promise<DossierStateRow | null>;
  /** Moves a hồ sơ loaded by stateRow: state, version + 1 and updated_at only, while the version is still `expectedVersion`. */
  updateState(id: string, expectedVersion: number, state: DossierState, updatedAt: Date): Promise<boolean>;
  /** Newest first, narrowed by `filter` in the same query. */
  list(scope: DataScope, filter?: DossierListFilter): Promise<Dossier[]>;
  /**
   * Story 79: how many hồ sơ, per xã and state, have been submitted but never reached the province. Only
   * counts: no row of a hồ sơ leaves the repository, so there is no scope to filter by.
   */
  countNotForwarded(filter?: { roundId?: string }): Promise<{ wardId: string; state: DossierState; count: number }[]>;
  /** Số hồ sơ chưa xong of a đợt: submitted into it and not yet in a finished state (see FINISHED_STATES). */
  countUnfinishedInRound(roundId: string): Promise<number>;
  appendEvent(e: DossierEvent): Promise<void>;
  /** Oldest first, for a hồ sơ within the scope. */
  events(scope: DataScope, dossierId: string): Promise<DossierEvent[]>;
  /** False, adding nothing, when the file is already in the kho. */
  addEvidence(e: { dossierId: string; fileId: string; addedBy: string; addedAt: Date }): Promise<boolean>;
  /** Kho minh chứng of a hồ sơ the caller has already loaded within its scope, oldest first. */
  evidence(dossierId: string): Promise<EvidenceFile[]>;
  /** Takes a file out of the kho with its ties to Tiêu chí; false when it was not there. */
  removeEvidence(dossierId: string, fileId: string): Promise<boolean>;
  /** Replaces the Tiêu chí a file of the kho is tied to. */
  setEvidenceLinks(dossierId: string, fileId: string, criterionIds: readonly string[]): Promise<void>;
  /** Every gắn minh chứng – tiêu chí of a hồ sơ already loaded within scope. */
  evidenceLinks(dossierId: string): Promise<EvidenceLink[]>;
  /** Tự chấm and giải trình of a hồ sơ already loaded within scope, one per Tiêu chí touched. */
  criterionEntries(dossierId: string): Promise<CriterionEntry[]>;
  /** Inserts or replaces the entry of one Tiêu chí. */
  saveCriterionEntry(e: CriterionEntry): Promise<void>;
  /** Appends a Phiên bản nộp with the files it refers to; the DB refuses any later change to either. */
  insertSubmission(s: Submission, files: readonly SubmissionFileRef[]): Promise<void>;
  /** Every Phiên bản nộp of a hồ sơ already loaded within scope, oldest first. */
  submissions(dossierId: string): Promise<Submission[]>;
  /** When each of these hồ sơ, already loaded within scope, was last nộp or nộp lại; absent if never. */
  lastSubmittedAt(dossierIds: readonly string[]): Promise<Map<string, Date>>;
  /** The newest Phiên bản nộp of a hồ sơ already loaded within scope. */
  latestSubmission(dossierId: string): Promise<Submission | null>;
  /** Every Checklist sơ bộ result recorded on a hồ sơ already loaded within scope. */
  checklistResults(dossierId: string): Promise<ChecklistResult[]>;
  /** Inserts or replaces the result of one item. */
  saveChecklistResult(r: ChecklistResult): Promise<void>;
  /** Appends a signed Báo cáo đánh giá cấp xã; the DB refuses any later change. */
  insertWardReport(r: WardReport): Promise<void>;
  /** Appends a đề nghị trả về of the xã; the app may not change or delete it afterwards. */
  insertReturnRequest(r: ReturnRequest): Promise<void>;
  /** Every đề nghị trả về of a hồ sơ already loaded within scope, oldest first. */
  returnRequests(dossierId: string): Promise<ReturnRequest[]>;
  /** Appends a đề nghị trả về of the Tổ tư vấn (TM-03); the app may not change or delete it afterwards. */
  insertAdvisoryReturnRequest(r: ReturnRequest): Promise<void>;
  /** Every đề nghị trả về of the Tổ tư vấn on a hồ sơ already loaded within scope, oldest first. */
  advisoryReturnRequests(dossierId: string): Promise<ReturnRequest[]>;
  /** The newest signed Báo cáo đánh giá cấp xã of a hồ sơ already loaded within scope, with its file name. */
  latestWardReport(dossierId: string): Promise<(WardReport & { fileName: string; fileStatus: FileStatus }) | null>;
}

/**
 * A signed Báo cáo đánh giá cấp xã (L06 XA-07): the PDF the Cán bộ xã uploaded after it was signed, tied
 * to the Phiên bản nộp it reports on. A later upload adds another; the newest one counts.
 */
export interface WardReport {
  id: string;
  dossierId: string;
  submissionNumber: number;
  fileId: string;
  uploadedBy: string;
  uploadedAt: Date;
}

/**
 * Đề nghị trả về (story 59): a Cán bộ xã asks the Sở to trả về a hồ sơ already gửi tỉnh, with a lý do.
 * It changes nothing on the hồ sơ; the Sở decides.
 */
export interface ReturnRequest {
  id: string;
  dossierId: string;
  reason: string;
  requestedBy: string;
  requestedAt: Date;
}

/** Story 61: how the xã found one item of the Checklist sơ bộ. */
export const CHECKLIST_RESULTS = ["pass", "fail", "needs_verification"] as const;
export type ChecklistResultValue = (typeof CHECKLIST_RESULTS)[number];

export const CHECKLIST_RESULT_LABEL: Record<ChecklistResultValue, string> = {
  pass: "Đạt",
  fail: "Không đạt",
  needs_verification: "Cần xác minh",
};

/** The result of one item of the đợt's Checklist sơ bộ on a hồ sơ, keyed by the item's code. */
export interface ChecklistResult {
  dossierId: string;
  itemCode: string;
  result: ChecklistResultValue;
  /** Nhận xét: a working note of the xã, never shown to the Chủ thể (story 35). */
  comment: string;
  assessedAt: Date;
  assessedBy: string;
}

/** Thông tin sản phẩm a hồ sơ must carry to be submitted (story 29); the others may stay blank. */
export const REQUIRED_PRODUCT_FIELDS: readonly ProductField[] = ["productName"];

export const PRODUCT_FIELD_LABEL: Record<ProductField, string> = {
  productName: "Tên sản phẩm",
  description: "Mô tả sản phẩm",
  ingredients: "Nguyên liệu và nguồn gốc",
  process: "Quy trình sản xuất",
  packaging: "Bao bì và nhãn mác",
  qualityDeclaration: "Công bố chất lượng",
};

/**
 * What a Phiên bản nộp holds (story 31): the bản làm việc and the Chủ thể as they were at that nộp or
 * nộp lại. Files are referred to by id, never copied. Written once, never changed (the DB refuses it).
 */
export interface SubmissionSnapshot {
  product: ProductInfo;
  criteriaSet: { id: string; code: string; name: string };
  criteriaVersion: { id: string; legalBasis: string };
  /** Thông tin định danh of the Chủ thể; a hộ sản xuất's số định danh only by its last four digits. */
  entity: {
    id: string;
    kind: EntityKind;
    name: string;
    taxCode: string | null;
    personalIdLast4: string | null;
    address: string;
    representativeName: string;
    phone: string;
    wardId: string;
  };
  /** The current giấy tờ pháp lý, with their dates of validity. */
  legalDocuments: {
    id: string;
    typeCode: string;
    typeName: string;
    documentNumber: string | null;
    issuedOn: string;
    validUntil: string | null;
    fileId: string;
    fileName: string;
  }[];
  /** The kho minh chứng. */
  evidence: { fileId: string; fileName: string }[];
  /** Every Tiêu chí in sheet order with its tự chấm (a Mức điểm, by id), giải trình and minh chứng. */
  criteria: {
    criterionId: string;
    code: string;
    name: string;
    partCode: string;
    levelId: string;
    points: number;
    explanation: string;
    evidenceFileIds: string[];
  }[];
  /** Tổng điểm and Hạng sao of the tự chấm, for reference only. */
  selfScore: { total: number; star: number };
  /**
   * The Phiếu đăng ký and Báo cáo tự đánh giá generated for this nộp (#37), as file ids. Null only in a
   * Phiên bản nộp written before the generation was in place.
   */
  documents: { registrationForm: string | null; selfAssessmentReport: string | null };
}

/** Phiên bản nộp (GLOSSARY.md): one per nộp or nộp lại, numbered from 1 within the hồ sơ. */
export interface Submission {
  id: string;
  dossierId: string;
  number: number;
  roundId: string;
  /** The xã it was submitted to. */
  wardId: string;
  submittedAt: Date;
  submittedBy: string;
  snapshot: SubmissionSnapshot;
}

export type SubmissionFileRole = "evidence" | "legal_document" | "registration_form" | "self_assessment_report";

export interface SubmissionFileRef {
  fileId: string;
  role: SubmissionFileRole;
}

/** Gắn minh chứng – tiêu chí (story 20): one file of the kho tied to one Tiêu chí. */
export interface EvidenceLink {
  fileId: string;
  criterionId: string;
}

/** What the Chủ thể wrote for one Tiêu chí of its hồ sơ: the Mức điểm picked when tự chấm thử, and its giải trình. */
export interface CriterionEntry {
  dossierId: string;
  criterionId: string;
  /** A Mức điểm of the Tiêu chí, in the published Phiên bản tiêu chí of the hồ sơ; null until picked. */
  scoreLevelId: string | null;
  explanation: string;
  updatedAt: Date;
}

export const dossierNotFound = () => new DomainError("not_found", "Không tìm thấy hồ sơ");

export const versionConflict = () => new DomainError("version_conflict", "Hồ sơ đã thay đổi, hãy tải lại trang trước khi thao tác tiếp");

/** Lý do loại sơ bộ (GLOSSARY.md, story 63): the fixed list a xã picks from instead of citing an Điều kiện loại. */
export const PRELIMINARY_REJECTION_REASONS = ["not_eligible", "wrong_ward", "no_supplement", "checklist_failed", "other"] as const;
export type PreliminaryRejectionReason = (typeof PRELIMINARY_REJECTION_REASONS)[number];

export const PRELIMINARY_REJECTION_REASON_LABEL: Record<PreliminaryRejectionReason, string> = {
  not_eligible: "Không đúng đối tượng",
  wrong_ward: "Không đúng địa bàn",
  no_supplement: "Không bổ sung",
  checklist_failed: "Chưa đạt Checklist sơ bộ",
  other: "Khác",
};

/**
 * Why a hồ sơ is Không đạt sơ bộ, as written in the metadata of the timeline row that put it there
 * (stories 35, 56, 63): an Điều kiện loại of its Bộ tiêu chí, or a Lý do loại sơ bộ, with a diễn giải.
 * `text` is the Điều kiện loại, or the label of the Lý do, as it read at that moment.
 */
export type RejectionGround =
  | { kind: "exclusion_condition"; exclusionConditionId: string; text: string; explanation: string }
  | { kind: "preliminary_reason"; reasonCode: PreliminaryRejectionReason; text: string; explanation: string };

/** What the Chủ thể and the xã see of a loại (story 35). */
export type DossierRejection = RejectionGround & { rejectedAt: Date };

/** The ground of the newest move into Không đạt sơ bộ among `events` (oldest first), if any. */
export function rejectionOf(events: readonly DossierEvent[]): DossierRejection | null {
  const e = events.findLast((x) => x.toState === "rejected_preliminary" && x.fromState !== "rejected_preliminary");
  if (!e) return null;
  const m = e.metadata;
  const text = typeof m.text === "string" ? m.text : "";
  const explanation = typeof m.explanation === "string" ? m.explanation : (e.reason ?? "");
  if (m.kind === "exclusion_condition" && typeof m.exclusionConditionId === "string") {
    return { kind: "exclusion_condition", exclusionConditionId: m.exclusionConditionId, text, explanation, rejectedAt: e.occurredAt };
  }
  const reasonCode = (PRELIMINARY_REJECTION_REASONS as readonly unknown[]).includes(m.reasonCode) ? (m.reasonCode as PreliminaryRejectionReason) : "other";
  return { kind: "preliminary_reason", reasonCode, text: text || PRELIMINARY_REJECTION_REASON_LABEL[reasonCode], explanation, rejectedAt: e.occurredAt };
}
