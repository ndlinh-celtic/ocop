/*
 * Đề xuất 5 sao (L17 SO-04, #87, spec #79 "Đề xuất 5 sao và Gói đề nghị 5 sao", GLOSSARY.md, ADR 0009). What the Cán bộ
 * Sở records of a hồ sơ 5 sao once the tỉnh sends its đề nghị to the Bộ, and how the Bộ's answer closed it. Append-only.
 */

/** Đánh dấu đã gửi: the công văn of the tỉnh's đề nghị. */
export interface FiveStarDispatch {
  dossierId: string;
  /** Số công văn, as printed. */
  dispatchNumber: string;
  /** Ngày gửi, YYYY-MM-DD. */
  sentOn: string;
  recordedBy: string;
  recordedAt: Date;
}

/** How the Bộ's answer closed a hồ sơ đề nghị 5 sao (story 58: Bộ công nhận 5 sao; story 59: kết quả khác). */
export const FIVE_STAR_CLOSURE_OUTCOMES = ["ministry_recognized_5_star", "other"] as const;
export type FiveStarClosureOutcome = (typeof FIVE_STAR_CLOSURE_OUTCOMES)[number];

export const FIVE_STAR_CLOSURE_LABEL: Record<FiveStarClosureOutcome, string> = {
  ministry_recognized_5_star: "Bộ công nhận 5 sao",
  other: "Kết quả khác",
};

export interface FiveStarClosure {
  dossierId: string;
  outcome: FiveStarClosureOutcome;
  /** Số and ngày (YYYY-MM-DD) of the Bộ's quyết định; set exactly for `ministry_recognized_5_star`. */
  decisionNumber: string | null;
  decidedOn: string | null;
  /** The Bộ's văn bản (purpose `ministry_document`). */
  fileId: string;
  closedBy: string;
  closedAt: Date;
}

/** A hồ sơ of the "Đề xuất 5 sao" list as the repo finds it. */
export interface FiveStarCandidate {
  dossierId: string;
  /** Hạng sao of the kết quả chốt hiện hành, as stored. */
  star: number;
  total: number;
}

export interface FiveStarRepo {
  /**
   * Story 46: hồ sơ Đã chốt điểm with Hạng sao 5 and Công bố kết quả, plus every hồ sơ Đã gửi đề nghị 5 sao; with
   * `awaiting` set, only those Đã gửi đề nghị 5 sao whose cờ chờ Quyết định công nhận bổ sung is (or is not) set.
   */
  candidates(filter?: { awaiting?: boolean }): Promise<FiveStarCandidate[]>;
  insertDispatch(d: FiveStarDispatch): Promise<void>;
  dispatchOf(dossierId: string): Promise<FiveStarDispatch | null>;
  insertClosure(c: FiveStarClosure): Promise<void>;
  closureOf(dossierId: string): Promise<FiveStarClosure | null>;
}
