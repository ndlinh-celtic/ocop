import type { CriteriaSetDetail } from "../criteria/detail";
import type { RankThresholds } from "../criteria/model";
import { averageScores, rankStoredSet, type StoredStarRank } from "../criteria/star-rank";

/*
 * L15 HD-04, HD-05 (spec #49 "Tổng hợp, Cờ chênh lệch, quyền xem điểm"; stories 98 to 101): the điểm tổng hợp of a
 * hồ sơ, computed from its phiếu đã xác nhận each time it is shown (and, in #60, at chốt). Nothing of it is stored
 * before chốt, and the Hạng sao comes only from the points: there is no way to set it by hand.
 */

export interface AggregateScores extends StoredStarRank {
  /** Mean points per Tiêu chí id over the counted phiếu (Quy tắc tổng hợp `mean`, the only one so far). */
  averages: Record<string, number>;
  sheetCount: number;
  /** Highest minus lowest tổng điểm of the counted phiếu; 0 with fewer than two. */
  deviation: number;
  /** Cờ chênh lệch: `deviation` at or above the đợt's `deviationFlagPoints` ("từ … trở lên"); never on fewer than two phiếu. */
  flagged: boolean;
}

export interface AggregateInput {
  set: CriteriaSetDetail;
  thresholds: RankThresholds;
  /** Points per Tiêu chí id of each phiếu đã xác nhận counted; a Tiêu chí without an entry scores 0. */
  sheets: readonly ReadonlyMap<string, number>[];
  deviationFlagPoints: number;
}

/** Same float tolerance as rankStars' sums: totals of whole points must compare exactly with the ngưỡng. */
const round9 = (n: number) => Math.round(n * 1e9) / 1e9;

export function aggregateScores({ set, thresholds, sheets, deviationFlagPoints }: AggregateInput): AggregateScores {
  const averages = sheets.length === 0 ? {} : averageScores(sheets.map((s) => Object.fromEntries(s)));
  const rank = rankStoredSet({ set, thresholds, scores: new Map(Object.entries(averages)) });
  const totals = sheets.map((scores) => rankStoredSet({ set, thresholds, scores }).total);
  const deviation = totals.length < 2 ? 0 : round9(Math.max(...totals) - Math.min(...totals));
  return { ...rank, averages, sheetCount: sheets.length, deviation, flagged: totals.length >= 2 && deviation >= deviationFlagPoints };
}
