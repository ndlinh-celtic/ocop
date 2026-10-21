import type { Star } from "../criteria/model";

/**
 * Báo cáo Tổ tư vấn (L10, L11; spec #49 "Báo cáo Tổ tư vấn"; GLOSSARY.md): one shared nháp per hồ sơ, written by
 * the Thành viên Tổ tư vấn Phân công on it, and the phiên bản the Tổ trưởng issues from it, numbered from 1 and
 * fixed once written (the DB refuses UPDATE and DELETE). The thành viên chấm read only the phiên bản.
 */

/** Đánh giá minh chứng of one Tiêu chí (story 44): đủ, thiếu, không hợp lệ, cần xác minh. */
export const EVIDENCE_ASSESSMENTS = ["sufficient", "missing", "invalid", "needs_verification"] as const;
export type EvidenceAssessment = (typeof EVIDENCE_ASSESSMENTS)[number];

/** What the Tổ tư vấn writes for one Tiêu chí; every field may stay empty in the nháp. */
export interface AdvisoryReportLine {
  criterionId: string;
  /** Điểm đề xuất: a Mức điểm of the Tiêu chí, in the hồ sơ's published Phiên bản tiêu chí. */
  levelId: string | null;
  /** Căn cứ of the Điểm đề xuất. */
  basis: string;
  /** Minh chứng of the newest Phiên bản nộp the căn cứ cites. */
  evidenceFileIds: string[];
  evidenceAssessment: EvidenceAssessment | null;
}

export interface AdvisoryReportDraft {
  dossierId: string;
  /** Bumped by every save; a save from an older one is refused (story 50). 0 means no nháp yet. */
  version: number;
  /** Nhận xét tổng hợp. */
  summary: string;
  /** Điểm cần hội đồng lưu ý. */
  notes: string;
  /** Biên bản and ảnh kiểm tra thực địa (story 48), files of purpose `advisory_attachment`. */
  attachmentFileIds: string[];
  lines: AdvisoryReportLine[];
  updatedAt: Date;
  updatedBy: string;
}

/** A phiên bản as issued: everything a reader needs, so it never depends on the nháp or on names changing later. */
export interface AdvisoryReportSnapshot {
  criteriaVersionId: string;
  criteriaSetId: string;
  /** The Phiên bản nộp the Tổ tư vấn reviewed. */
  submissionNumber: number | null;
  lines: {
    criterionId: string;
    code: string;
    name: string;
    partCode: string;
    maxPoints: number;
    levelId: string;
    levelDescription: string;
    points: number;
    basis: string;
    evidence: { fileId: string; fileName: string }[];
    evidenceAssessment: EvidenceAssessment | null;
  }[];
  summary: string;
  notes: string;
  attachments: { fileId: string; fileName: string }[];
  /** Tổng Phần A/B/C, tổng điểm and Hạng sao ước lượng of the Điểm đề xuất, for reference. */
  estimate: { parts: { code: string; total: number }[]; total: number; star: Star };
}

export interface AdvisoryReportVersion {
  id: string;
  dossierId: string;
  /** 1, 2, … within the hồ sơ. */
  number: number;
  snapshot: AdvisoryReportSnapshot;
  issuedBy: string;
  issuedAt: Date;
  /** Why it was issued again; null for phiên bản 1 only. */
  reason: string | null;
}

export interface AdvisoryReportRepo {
  /** The nháp of a hồ sơ already loaded within scope; null before the first save. */
  draft(dossierId: string): Promise<AdvisoryReportDraft | null>;
  /** Writes the nháp with its lines replaced, only while its stored version is `expectedVersion` (0: none yet); false otherwise. */
  saveDraft(draft: AdvisoryReportDraft, expectedVersion: number): Promise<boolean>;
  /** Every issued phiên bản of a hồ sơ already loaded within scope, oldest first. */
  versions(dossierId: string): Promise<AdvisoryReportVersion[]>;
  insertVersion(version: AdvisoryReportVersion): Promise<void>;
}
