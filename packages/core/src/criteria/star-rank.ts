import { criteriaOf, type CriteriaSet, type Criterion, type CriterionScores, type RankThresholds, type ScoreLevel, type Star } from "./model";
import type { CriteriaSetDetail } from "./detail";
import { sum } from "./helpers";

export interface StarRankInput {
  readonly set: CriteriaSet;
  readonly thresholds: RankThresholds;
  readonly scores: CriterionScores;
}

export interface PartTotal {
  readonly code: string;
  readonly total: number;
}

/** A Sao tối thiểu requirement the scores miss: reaching `star` needs `required` points on the Tiêu chí. */
export interface UnmetMinimumStar {
  readonly code: string;
  readonly name: string;
  readonly star: Star;
  readonly required: number;
  readonly actual: number;
}

export interface StarRank {
  readonly parts: readonly PartTotal[];
  readonly total: number;
  /** Highest Hạng sao whose Ngưỡng hạng the total reaches; 1 below the 2-star threshold. */
  readonly byThreshold: Star;
  /** Highest Hạng sao whose Sao tối thiểu requirements are all met. */
  readonly byMinimumStars: Star;
  /** The Hạng sao: the lower of `byThreshold` and `byMinimumStars`. */
  readonly star: Star;
  /** Every unmet requirement, by star then in sheet order; those at `star + 1` are what blocks the next rank. */
  readonly unmet: readonly UnmetMinimumStar[];
}

/**
 * Sums raw (possibly averaged) points, then rounds to 1e-9 to drop float noise: averages in thirds that add up
 * to 50 must compare as 50. Always sum raw scores; summing already-rounded totals compounds the error.
 */
const roundedSum = (values: readonly number[]) => Math.round(sum(values) * 1e9) / 1e9;

const THRESHOLD_STARS = [5, 4, 3, 2] as const;

const starByThreshold = (total: number, thresholds: RankThresholds): Star => THRESHOLD_STARS.find((s) => total >= thresholds[s]) ?? 1;

/** Float noise allowed when comparing averaged points with a Sao tối thiểu requirement (same 1e-9 as `roundedSum`). */
const EPS = 1e-9;

/**
 * The requirements of one Tiêu chí: for each Sao tối thiểu s printed on it, reaching s stars needs the points
 * of the highest Mức điểm whose Sao tối thiểu is at most s. When the Tiêu chí splits into nhánh a/b, each
 * nhánh has its own requirement (a level without a nhánh belongs to every nhánh, and a nhánh without such a
 * level requires nothing); the score cannot tell which nhánh was chosen, so it meets s when it meets the
 * requirement of at least one nhánh, i.e. the lowest.
 */
function requirementsOf(criterion: Criterion): { star: Star; required: number }[] {
  const { levels } = criterion;
  const stars = [...new Set(levels.flatMap((l) => (l.minimumStar === null ? [] : [l.minimumStar])))].sort((a, b) => a - b);
  const branches = [...new Set(levels.flatMap((l) => (l.branch === null ? [] : [l.branch])))];
  const levelsByBranch = branches.length === 0 ? [levels] : branches.map((b) => levels.filter((l) => l.branch === null || l.branch === b));
  const requiredIn = (branchLevels: readonly ScoreLevel[], star: Star) =>
    Math.max(0, ...branchLevels.filter((l) => l.minimumStar !== null && l.minimumStar <= star).map((l) => l.points));
  return stars.map((star) => ({ star, required: Math.min(...levelsByBranch.map((ls) => requiredIn(ls, star))) }));
}

/** Mean points per Tiêu chí over several score sheets; a sheet that lacks a Tiêu chí counts 0 for it. */
export function averageScores(sheets: readonly CriterionScores[]): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const sheet of sheets) for (const [code, points] of Object.entries(sheet)) sums[code] = (sums[code] ?? 0) + points;
  return Object.fromEntries(Object.entries(sums).map(([code, sum]) => [code, sum / sheets.length]));
}

export function rankStars({ set, thresholds, scores }: StarRankInput): StarRank {
  const parts = set.parts.map((part) => ({ code: part.code, criteria: criteriaOf(part) }));
  return rankBy(parts, thresholds, (c) => scores[c.code] ?? 0, () => ({}));
}

export interface StoredStarRankInput {
  readonly set: CriteriaSetDetail;
  readonly thresholds: RankThresholds;
  /** Points per Tiêu chí id; a Tiêu chí without an entry scores 0. */
  readonly scores: ReadonlyMap<string, number>;
}

/** An unmet Sao tối thiểu of a stored Tiêu chí, identified by id because a draft may repeat a code. */
export interface StoredUnmetMinimumStar extends UnmetMinimumStar {
  readonly criterionId: string;
}

export interface StoredStarRank extends StarRank {
  readonly unmet: readonly StoredUnmetMinimumStar[];
}

/** rankStars for a stored Bộ tiêu chí, with scores keyed by Tiêu chí id (a draft can hold duplicate codes). */
export function rankStoredSet({ set, thresholds, scores }: StoredStarRankInput): StoredStarRank {
  const parts = set.parts.map((part) => ({ code: part.code, criteria: criteriaOf(part) }));
  return rankBy(parts, thresholds, (c) => scores.get(c.id) ?? 0, (c) => ({ criterionId: c.id }));
}

function rankBy<C extends Criterion, K extends object>(
  scoredParts: readonly { code: string; criteria: readonly C[] }[],
  thresholds: RankThresholds,
  scoreOf: (c: C) => number,
  keyOf: (c: C) => K,
): StarRank & { unmet: (K & UnmetMinimumStar)[] } {
  const parts = scoredParts.map((part) => ({ code: part.code, total: roundedSum(part.criteria.map(scoreOf)) }));
  const all = scoredParts.flatMap((p) => p.criteria);
  const total = roundedSum(all.map(scoreOf));

  const unmet = all
    .flatMap((c) =>
      requirementsOf(c)
        .filter((r) => scoreOf(c) + EPS < r.required)
        .map((r) => ({ ...keyOf(c), code: c.code, name: c.name, star: r.star, required: r.required, actual: scoreOf(c) })),
    )
    .sort((a, b) => a.star - b.star);

  const byThreshold = starByThreshold(total, thresholds);
  const firstBlocked = unmet[0]?.star;
  const byMinimumStars = firstBlocked === undefined ? 5 : ((firstBlocked - 1) as Star);
  return { parts, total, byThreshold, byMinimumStars, star: Math.min(byThreshold, byMinimumStars) as Star, unmet };
}
