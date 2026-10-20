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
  /** Newest first. */
  list(scope: DataScope): Promise<Dossier[]>;
  appendEvent(e: DossierEvent): Promise<void>;
  /** Oldest first, for a hồ sơ within the scope. */
  events(scope: DataScope, dossierId: string): Promise<DossierEvent[]>;
  /** False, adding nothing, when the file is already in the kho. */
  addEvidence(e: { dossierId: string; fileId: string; addedBy: string; addedAt: Date }): Promise<boolean>;
  /** Kho minh chứng of a hồ sơ the caller has already loaded within its scope, oldest first. */
  evidence(dossierId: string): Promise<EvidenceFile[]>;
}

export const dossierNotFound = () => new DomainError("not_found", "Không tìm thấy hồ sơ");

export const versionConflict = () => new DomainError("version_conflict", "Hồ sơ đã thay đổi, hãy tải lại trang trước khi thao tác tiếp");
