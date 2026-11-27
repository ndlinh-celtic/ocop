import type { CriteriaSetDetail } from "../criteria/detail";
import { criteriaOf } from "../criteria/model";
import type { AggregateResult } from "../scoring/meeting-model";

/*
 * Tiêu chí dưới mức (L16, #80, spec #79 story 37, GLOSSARY.md): what a Chủ thể should improve, computed from the kết quả
 * chốt hiện hành. The Sở may adjust the list before it issues a Thư kết quả không đạt (#84); this is the automatic one.
 */

/** Why a Tiêu chí is dưới mức: a Sao tối thiểu the kết quả misses, or an average below the ratio of its điểm tối đa. */
export type UnderperformingReason = "min_star" | "low_ratio";

export interface UnderperformingCriterion {
  criterionId: string;
  code: string;
  name: string;
  /** Điểm trung bình of the kết quả chốt; 0 for a Tiêu chí without one. */
  average: number;
  maxPoints: number;
  reasons: UnderperformingReason[];
}

/** Default of the system setting `results.underperforming_ratio`. */
export const DEFAULT_UNDERPERFORMING_RATIO = 0.5;

/** Same float tolerance as the star rank: an average of thirds that equals the bound is not below it. */
const EPS = 1e-9;

/**
 * Every Tiêu chí of the Bộ tiêu chí, in sheet order, that is dưới mức in the kết quả chốt: one of its Sao tối thiểu is unmet,
 * or its average is strictly below `ratio` × its điểm tối đa. A Tiêu chí that is both is listed once with both reasons.
 */
export function underperformingCriteria(
  aggregate: Pick<AggregateResult, "averages" | "unmet">,
  set: CriteriaSetDetail,
  ratio: number,
): UnderperformingCriterion[] {
  const unmet = new Set(aggregate.unmet.map((u) => u.criterionId));
  return set.parts.flatMap(criteriaOf).flatMap((c) => {
    const average = aggregate.averages[c.id] ?? 0;
    const reasons: UnderperformingReason[] = [];
    if (unmet.has(c.id)) reasons.push("min_star");
    if (average + EPS < ratio * c.maxPoints) reasons.push("low_ratio");
    return reasons.length === 0 ? [] : [{ criterionId: c.id, code: c.code, name: c.name, average, maxPoints: c.maxPoints, reasons }];
  });
}
