import type { UnderperformingReason } from "./underperforming";

/*
 * Thư kết quả không đạt (L16 HD-10, #85, spec #79 "Thư kết quả không đạt", GLOSSARY.md). The Cán bộ Sở issues it for a hồ
 * sơ dưới 3 sao Đã chốt điểm; each phiên bản is kept as issued (PDF and data), a thư đính chính is the next `n` with its
 * lý do. The Chủ thể sees only the newest.
 */

/** A Tiêu chí dưới mức as the letter lists it; `reasons` is empty for one the Sở added beyond the computed list. */
export interface LetterCriterion {
  criterionId: string;
  code: string;
  name: string;
  average: number;
  maxPoints: number;
  reasons: UnderperformingReason[];
}

export interface ResultLetter {
  id: string;
  dossierId: string;
  /** 1 for the letter, 2… for each thư đính chính. */
  n: number;
  criteria: LetterCriterion[];
  advice: string;
  /** Why a thư đính chính was issued; null for n = 1. */
  reason: string | null;
  /** The PDF, a `generated_document`. */
  fileId: string;
  /** The Mẫu văn bản phiên bản it was filled from; null for the mẫu mặc định. */
  templateVersionId: string | null;
  issuedBy: string;
  issuedAt: Date;
}

export interface ResultLetterRepo {
  /** False when the hồ sơ already has a letter numbered `n` (a concurrent issue). */
  insert(letter: ResultLetter): Promise<boolean>;
  /** Every phiên bản of a hồ sơ, oldest first. */
  list(dossierId: string): Promise<ResultLetter[]>;
}
