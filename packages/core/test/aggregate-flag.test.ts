import { describe, expect, it } from "vitest";
import type { CriteriaSetDetail } from "../src/criteria/detail";
import { aggregateScores } from "../src/scoring/aggregate";

/* A one-Tiêu chí Bộ tiêu chí ("c", 0 to 100 points): each phiếu's tổng điểm is its points for "c". */
const set: CriteriaSetDetail = {
  id: "set",
  code: "1",
  name: "Bộ thử",
  totalPoints: 100,
  headerNote: "",
  footerNote: "",
  extractionNote: "",
  sourcePages: [],
  exclusionConditions: [],
  parts: [
    {
      id: "A",
      code: "A",
      name: "Phần A",
      points: 100,
      sections: [
        {
          id: "1",
          code: "1",
          name: "Mục 1",
          points: 100,
          items: [{ kind: "criterion", id: "c", code: "1.1", name: "Tiêu chí", requirement: "", maxPoints: 100, note: "", extractionNote: "", levels: [] }],
        },
      ],
    },
  ],
};

const flagOf = (totals: number[], deviationFlagPoints: number) =>
  aggregateScores({
    set,
    thresholds: { 2: 30, 3: 50, 4: 70, 5: 90 },
    sheets: totals.map((t) => new Map([["c", t]])),
    deviationFlagPoints,
  }).flagged;

describe("L15 HD-05 Cờ chênh lệch: tổng điểm lệch từ ngưỡng trở lên (#75)", () => {
  it.each([
    [[60, 50.01], 10, false],
    [[60, 50], 10, true],
    [[60, 55, 70], 10, true],
    [[60, 60], 0.01, false],
  ])("phiếu totalling %j against ngưỡng %d: cờ %s", (totals, threshold, flagged) => {
    expect(flagOf(totals, threshold)).toBe(flagged);
  });

  it("raises no cờ on a single phiếu: there is nothing to differ from, even at the smallest ngưỡng", () => {
    expect(flagOf([60], 0.01)).toBe(false);
  });
});
