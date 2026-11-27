import { DomainError } from "../shared/errors";
import { defineSetting } from "../system/settings";
import { DEFAULT_UNDERPERFORMING_RATIO } from "./underperforming";

const invalidRatio = () =>
  new DomainError("invalid_underperforming_ratio", "Tỷ lệ Tiêu chí dưới mức là một số lớn hơn 0 và không quá 1 (ví dụ 0,5 là 50% điểm tối đa)");

/** A number in (0, 1]; refuses anything else. */
function normalizeRatio(ratio: unknown): number {
  if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio <= 0 || ratio > 1) throw invalidRatio();
  return ratio;
}

/**
 * L16 (#80, stories 35, 37): the ratio of điểm tối đa below which a Tiêu chí is dưới mức, default 0,5. Views and Thư kết
 * quả không đạt computed after Quản trị changes it use the new one.
 */
export const UNDERPERFORMING_RATIO = defineSetting<{ ratio: number }>({
  keys: { ratio: "results.underperforming_ratio" },
  defaults: { ratio: DEFAULT_UNDERPERFORMING_RATIO },
  normalize: ({ ratio }) => ({ ratio: normalizeRatio(ratio) }),
  auditAction: "system.underperforming_ratio_changed",
});
