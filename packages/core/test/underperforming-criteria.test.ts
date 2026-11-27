import { describe, expect, it } from "vitest";
import type { CriteriaSetDetail, StoredCriterion } from "../src/criteria/detail";
import { underperformingCriteria } from "../src/results/underperforming";

/*
 * L16 (#80, spec #79 story 37, GLOSSARY "Tiêu chí dưới mức"): a Tiêu chí is dưới mức when the kết quả chốt misses one of
 * its Sao tối thiểu, or when its điểm trung bình is below the configured ratio of its điểm tối đa (default 50%).
 */

const criterion = (id: string, code: string, maxPoints: number, levels: [number, number | null][]): StoredCriterion => ({
  kind: "criterion",
  id,
  code,
  name: `Tiêu chí ${code}`,
  requirement: "",
  maxPoints,
  note: "",
  extractionNote: "",
  levels: levels.map(([points, minimumStar], i) => ({
    id: `${id}-${i}`,
    description: `${points} điểm`,
    points,
    minimumStar: minimumStar as 1 | 2 | 3 | 4 | 5 | null,
    branch: null,
    systemAdded: false,
  })),
});

/* 1.1 (A, 0/20/40, reaching 3 sao needs 20), 2.1 (B, 0/10/25), 3.1 (C, 0/35). */
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
      points: 40,
      sections: [
        {
          id: "s1",
          code: "1",
          name: "Mục 1",
          points: 40,
          items: [
            criterion("c11", "1.1", 40, [
              [0, null],
              [20, 3],
              [40, null],
            ]),
          ],
        },
      ],
    },
    {
      id: "B",
      code: "B",
      name: "Phần B",
      points: 25,
      sections: [
        {
          id: "s2",
          code: "2",
          name: "Mục 2",
          points: 25,
          items: [
            criterion("c21", "2.1", 25, [
              [0, null],
              [10, null],
              [25, null],
            ]),
          ],
        },
      ],
    },
    {
      id: "C",
      code: "C",
      name: "Phần C",
      points: 35,
      sections: [
        {
          id: "s3",
          code: "3",
          name: "Mục 3",
          points: 35,
          items: [
            criterion("c31", "3.1", 35, [
              [0, null],
              [35, null],
            ]),
          ],
        },
      ],
    },
  ],
};

const unmet11 = { criterionId: "c11", code: "1.1", name: "Tiêu chí 1.1", star: 3 as const, required: 20, actual: 10 };

describe("Tiêu chí dưới mức (#80, story 37)", () => {
  it("lists a Tiêu chí whose Sao tối thiểu the kết quả chốt misses, with its average and điểm tối đa", () => {
    const list = underperformingCriteria({ averages: { c11: 10, c21: 25, c31: 35 }, unmet: [unmet11] }, set, 0.2);

    expect(list).toEqual([{ criterionId: "c11", code: "1.1", name: "Tiêu chí 1.1", average: 10, maxPoints: 40, reasons: ["min_star"] }]);
  });

  it.each([
    [12.4, true],
    [12.5, false],
    [12.6, false],
  ])("with ratio 0,5 a Tiêu chí of 25 điểm tối đa averaging %d is dưới mức: %s (strictly below half)", (average, listed) => {
    const list = underperformingCriteria({ averages: { c11: 40, c21: average, c31: 35 }, unmet: [] }, set, 0.5);

    expect(list.map((c) => c.code)).toEqual(listed ? ["2.1"] : []);
    if (listed) expect(list[0]).toMatchObject({ average, maxPoints: 25, reasons: ["low_ratio"] });
  });

  it("lists a Tiêu chí both below its Sao tối thiểu and below the ratio once, with both reasons, in sheet order", () => {
    const list = underperformingCriteria({ averages: { c11: 10, c31: 0 }, unmet: [unmet11] }, set, 0.5);

    expect(list.map((c) => [c.code, c.reasons, c.average])).toEqual([
      ["1.1", ["min_star", "low_ratio"], 10],
      ["2.1", ["low_ratio"], 0],
      ["3.1", ["low_ratio"], 0],
    ]);
  });

  it("lists nothing when every Sao tối thiểu is met and every average reaches the ratio", () => {
    expect(underperformingCriteria({ averages: { c11: 20, c21: 25, c31: 35 }, unmet: [] }, set, 0.5)).toEqual([]);
  });
});
