/*
 * L04 CT-11, XA-05: the yêu cầu bổ sung of a hồ sơ and its port. Use cases are in supplement.ts.
 */

/** How a yêu cầu bổ sung ended. */
export type SupplementOutcome = "resubmitted" | "closed_unsupplemented";

/** One nội dung of a yêu cầu bổ sung, tied to at most one Tiêu chí or one loại giấy tờ, with its answer. */
export interface SupplementItem {
  id: string;
  requestId: string;
  position: number;
  content: string;
  criterionId: string | null;
  legalDocumentTypeCode: string | null;
  /** The Chủ thể's answer; empty until written. */
  response: string;
  respondedAt: Date | null;
  respondedBy: string | null;
}

export interface SupplementRequest {
  id: string;
  dossierId: string;
  requestedBy: string;
  /** The Vai trò it was asked under: the Cán bộ xã here, the Cán bộ Sở when returned by the tỉnh (#44). */
  requestedRole: string;
  requestedAt: Date;
  /** 23:59:59 giờ Việt Nam of the chosen day. */
  deadline: Date;
  closedAt: Date | null;
  outcome: SupplementOutcome | null;
  items: SupplementItem[];
}

/** Rows of yêu cầu bổ sung of a hồ sơ the caller has already loaded within its scope. */
export interface SupplementRepo {
  insert(r: SupplementRequest): Promise<void>;
  /** Oldest first, each with its nội dung in order. */
  list(dossierId: string): Promise<SupplementRequest[]>;
  /** The one request of the hồ sơ not yet closed, if any. */
  findOpen(dossierId: string): Promise<SupplementRequest | null>;
  /** Writes the answer to one nội dung of the request. */
  respond(itemId: string, answer: { response: string; respondedAt: Date; respondedBy: string }): Promise<void>;
  close(requestId: string, closedAt: Date, outcome: SupplementOutcome): Promise<void>;
}
