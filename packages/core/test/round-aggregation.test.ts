import { describe, expect, it } from "vitest";
import { checkedAggregation } from "../src/rounds/manage";

const rule = (deviationFlagPoints: number) => ({ method: "mean" as const, minGraders: 5, deviationFlagPoints });

describe("L07 HD-06 Quy tắc tổng hợp: ngưỡng cờ chênh lệch", () => {
  it.each([
    [0, 0],
    [15, 15],
    [12.5, 12.5],
    [99999.99, 99999.99],
    // Float noise from a form is not a third decimal: it is stored, and compared, as 12.5.
    [12.499999999, 12.5],
  ])("accepts %d as %d điểm", (given, stored) => {
    expect(checkedAggregation(rule(given))).toEqual(rule(stored));
  });

  it.each([
    ["negative", -1],
    ["above numeric(7,2)", 100000],
    ["three decimals", 1.234],
    ["not a number", Number.NaN],
    ["infinite", Number.POSITIVE_INFINITY],
  ])("refuses a value that is %s", (_label, given) => {
    expect(() => checkedAggregation(rule(given))).toThrow(expect.objectContaining({ code: "invalid_aggregation" }));
  });
});
