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
  copiedFrom: string | null;
  deletedAt: Date | null;
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
  handlerUserId?: string;
}

/**
 * Every read takes the reader's DataScope and filters in SQL (#14); a deleted Nháp is never returned.
 * Out-of-scope rows come back as absent.
 */
export interface DossierRepo {
  insert(d: Dossier): Promise<void>;
  findById(scope: DataScope, id: string): Promise<Dossier | null>;
  /** findById with the row locked FOR UPDATE until the transaction ends. */
  lock(scope: DataScope, id: string): Promise<Dossier | null>;
  /** Writes every mutable field, only while the stored version is still `expectedVersion`; false otherwise. */
  update(d: Dossier, expectedVersion: number): Promise<boolean>;
  /** Newest first, narrowed by `filter` in the same query. */
  list(scope: DataScope, filter?: DossierListFilter): Promise<Dossier[]>;
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
