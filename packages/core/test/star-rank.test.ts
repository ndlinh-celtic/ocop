import { describe, expect, it } from "vitest";
import type { CriteriaSet, Criterion, ScoreLevel, Star } from "../src/criteria/model";
import { averageScores, rankStars } from "../src/criteria/star-rank";
import { QD26_THRESHOLDS, qd26Set, scoresTotalling, topScores } from "./qd26";

const set1 = qd26Set(1);
const rank = (scores: Record<string, number>, set = set1) => rankStars({ set, thresholds: QD26_THRESHOLDS, scores });

describe("L19 Hạng sao: tổng điểm", () => {
  it("bộ 1 at every highest Mức điểm totals 100, Phần A/B/C 40/25/35", () => {
    const result = rank(topScores(set1));
    expect(result.total).toBe(100);
    expect(result.parts).toEqual([
      { code: "A", total: 40 },
      { code: "B", total: 25 },
      { code: "C", total: 35 },
    ]);
  });

  it("a Tiêu chí with no score counts as 0", () => {
    const scores = topScores(set1);
    delete scores["2.4"];
    delete scores["4.1"];
    const result = rank(scores);
    expect(result.total).toBe(94);
    expect(result.parts).toEqual([
      { code: "A", total: 39 },
      { code: "B", total: 20 },
      { code: "C", total: 35 },
    ]);
  });
});

describe("L19 Hạng sao: hạng theo Ngưỡng hạng 30/50/70/90", () => {
  it.each([
    [0, 1],
    [29, 1],
    [30, 2],
    [49, 2],
    [50, 3],
    [69, 3],
    [70, 4],
    [89, 4],
    [90, 5],
    [100, 5],
  ])("total %i ranks %i star by threshold", (total, star) => {
    const result = rank(scoresTotalling(set1, total));
    expect(result.total).toBe(total);
    expect(result.byThreshold).toBe(star);
  });
});

describe("L19 Hạng sao: Sao tối thiểu", () => {
  // Bộ 1, tiêu chí 1.5 "Liên kết sản xuất": 2 points is ****, 3 points is *****.
  const with15 = (points: number) => ({ ...topScores(set1), "1.5": points });

  it("1.5 at 3 points meets *****: 5 sao, nothing unmet", () => {
    const result = rank(with15(3));
    expect(result.byMinimumStars).toBe(5);
    expect(result.star).toBe(5);
    expect(result.unmet).toEqual([]);
  });

  it("1.5 at 2 points meets **** but not *****: total 99 still ranks 4 sao, blocked by 1.5", () => {
    const result = rank(with15(2));
    expect(result.total).toBe(99);
    expect(result.byThreshold).toBe(5);
    expect(result.byMinimumStars).toBe(4);
    expect(result.star).toBe(4);
    expect(result.unmet).toEqual([{ code: "1.5", name: "Liên kết sản xuất", star: 5, required: 3, actual: 2 }]);
  });

  it("1.5 at 1 point fails both ****  and *****: 3 sao", () => {
    const result = rank(with15(1));
    expect(result.byMinimumStars).toBe(3);
    expect(result.star).toBe(3);
    expect(result.unmet).toEqual([
      { code: "1.5", name: "Liên kết sản xuất", star: 4, required: 2, actual: 1 },
      { code: "1.5", name: "Liên kết sản xuất", star: 5, required: 3, actual: 1 },
    ]);
  });

  it("a Sao tối thiểu on a low level needs only that level, even for 5 sao", () => {
    // Bộ 1, tiêu chí 1.6: the 1-point level is ****, the higher levels carry no Sao tối thiểu.
    const result = rank({ ...topScores(set1), "1.6": 1 });
    expect(result.byMinimumStars).toBe(5);
    expect(result.unmet).toEqual([]);
  });

  it("the threshold caps the rank when every Sao tối thiểu is met", () => {
    // Drop 25 points only from Tiêu chí without Sao tối thiểu: total 75.
    const result = rank({
      ...topScores(set1),
      "1.1": 1, "1.4": 1, "3.1": 1, "3.3": 1, "4.2": 0, "4.3": 0, "6.3": 0, "6.4": 0, "11": 1, "12": 1,
    });
    expect(result.total).toBe(75);
    expect(result.byThreshold).toBe(4);
    expect(result.byMinimumStars).toBe(5);
    expect(result.star).toBe(4);
  });

  it("an empty Phần C can cap a 60-point sheet at 2 sao", () => {
    // Phần A and B full except 5.3, Phần C empty; 5.3 (*** at 1), 9 (*** at 2), 10 (*** at 1) fail ***.
    const result = rank(scoresTotalling(set1, 60));
    expect(result.byThreshold).toBe(3);
    expect(result.byMinimumStars).toBe(2);
    expect(result.star).toBe(2);
    expect(result.unmet.filter((u) => u.star === 3).map((u) => u.code)).toEqual(["5.3", "9", "10"]);
  });
});

describe("L19 Hạng sao: Tiêu chí with nhánh a/b (bộ 26)", () => {
  const set26 = qd26Set(26);

  it("counts the one chosen Mức điểm, never both branches: a full sheet is 100, not 108", () => {
    // Tiêu chí 8, 9, 15 each offer a and b branches with the same maximum (3, 2, 3).
    const result = rank(topScores(set26), set26);
    expect(result.total).toBe(100);
    expect(result.star).toBe(5);
  });

  it("the lower level of branch a on 8 and of branch b on 9 lowers the total by 3", () => {
    const result = rank({ ...topScores(set26), "8": 1, "9": 1 }, set26);
    expect(result.total).toBe(97);
    expect(result.star).toBe(5);
  });
});

describe("L15 Hạng sao from several score sheets", () => {
  const sheetsWith15 = (...points: number[]) => points.map((p) => ({ ...topScores(set1), "1.5": p }));

  it("averages each Tiêu chí over the sheets; a sheet without the Tiêu chí counts 0", () => {
    expect(averageScores([{ "1.1": 3, "1.5": 2 }, { "1.1": 2, "1.5": 3 }, { "1.1": 1 }])).toEqual({ "1.1": 2, "1.5": 5 / 3 });
  });

  it("1.5 averaging 2⅔ falls short of ***** (3): 4 sao", () => {
    const result = rank(averageScores(sheetsWith15(3, 3, 2)));
    expect(result.star).toBe(4);
    expect(result.unmet).toEqual([{ code: "1.5", name: "Liên kết sản xuất", star: 5, required: 3, actual: 8 / 3 }]);
  });

  it("1.5 averaging 2⅓ meets **** (2): still 4 sao", () => {
    expect(rank(averageScores(sheetsWith15(2, 2, 3))).byMinimumStars).toBe(4);
  });

  it("1.5 averaging 1⅔ falls short of **** (2): 3 sao", () => {
    expect(rank(averageScores(sheetsWith15(2, 2, 1))).byMinimumStars).toBe(3);
  });

  it("three 90-point sheets that differ on every reduced Tiêu chí average to 90, so 5 sao", () => {
    const top = topScores(set1);
    const result = rank(
      averageScores([
        { ...top, "4.3": 0, "6.3": 0, "11": 0 },
        { ...top, "1.1": 1, "1.4": 1, "3.1": 1, "3.3": 1, "12": 1 },
        { ...top, "4.2": 0, "6.4": 0, "12": 1, "11": 0 },
      ]),
    );
    expect(result.total).toBe(90);
    expect(result.byThreshold).toBe(5);
    expect(result.star).toBe(5);
  });

  it("averages in thirds that add up to exactly 50 reach the 3-star threshold despite float rounding", () => {
    // Naive float summing of these averages gives 49.99999999999999.
    const codes = Object.keys(topScores(set1));
    const sheet = (points: number[]) => Object.fromEntries(codes.map((code, i) => [code, points[i] ?? 0]));
    const result = rank(
      averageScores([
        sheet([0, 1, 3, 2, 3, 0, 1, 3, 2, 1, 0, 0, 1, 3, 2, 1, 5, 3, 2, 0, 0, 1, 1, 1, 0, 2, 3, 4, 4, 4, 1, 3]),
        sheet([3, 0, 3, 1, 2, 0, 1, 1, 2, 3, 1, 2, 0, 3, 0, 0, 1, 2, 5, 3, 0, 2, 1, 0, 0, 1, 0, 0, 5, 4, 2, 1]),
        sheet([1, 1, 2, 1, 1, 1, 0, 1, 0, 2, 1, 0, 1, 3, 2, 3, 5, 0, 1, 5, 2, 5, 2, 0, 1, 2, 0, 0, 0, 0, 1, 0]),
      ]),
    );
    expect(result.total).toBe(50);
    expect(result.byThreshold).toBe(3);
  });
});

/** Replaces the Mức điểm of one Tiêu chí, so a test can state the exact levels it ranks against. */
function withLevels(set: CriteriaSet, code: string, levels: ScoreLevel[]): CriteriaSet {
  const edit = (c: Criterion): Criterion => (c.code === code ? { ...c, levels } : c);
  return {
    ...set,
    parts: set.parts.map((p) => ({
      ...p,
      sections: p.sections.map((s) => ({
        ...s,
        items: s.items.map((i) => (i.kind === "group" ? { ...i, criteria: i.criteria.map(edit) } : edit(i))),
      })),
    })),
  };
}
const level = (points: number, minimumStar: Star | null, branch: string | null = null): ScoreLevel => ({
  description: `${branch ?? ""} ${points}`,
  points,
  minimumStar,
  branch,
});

describe("L15 Sao tối thiểu on averaged scores", () => {
  it("three sheets at 0.7 meet a 0.7-point Sao tối thiểu despite float rounding", () => {
    // 0.7 + 0.7 + 0.7 = 2.0999999999999996 in floats, so the naive mean is 0.6999999999999998.
    const set = withLevels(set1, "1.5", [level(0, null), level(0.7, 5), level(3, null)]);
    const scores = averageScores([0.7, 0.7, 0.7].map((p) => ({ ...topScores(set1), "1.5": p })));
    const result = rank(scores, set);
    expect(result.unmet).toEqual([]);
    expect(result.byMinimumStars).toBe(5);
  });
});

describe("L19 Sao tối thiểu per nhánh a/b (bộ 26, edited)", () => {
  const NAME_8 = "Đáp ứng điều kiện kinh doanh dịch vụ";
  // Tiêu chí 8 edited: branch a needs 3 points for 4 sao, branch b needs only 1; the 0 level has no branch.
  const set26 = withLevels(qd26Set(26), "8", [level(0, null), level(1, null, "a"), level(3, 4, "a"), level(1, 4, "b"), level(3, null, "b")]);

  it("1 point meets 4 sao through branch b, though branch a would need 3", () => {
    const result = rank({ ...topScores(set26), "8": 1 }, set26);
    expect(result.unmet).toEqual([]);
    expect(result.byMinimumStars).toBe(5);
  });

  it("0 points meets no branch: blocked at 4 sao by the easiest branch's 1 point", () => {
    const result = rank({ ...topScores(set26), "8": 0 }, set26);
    expect(result.byMinimumStars).toBe(3);
    expect(result.unmet).toEqual([{ code: "8", name: NAME_8, star: 4, required: 1, actual: 0 }]);
  });

  it("an unbranched level's Sao tối thiểu applies to every branch", () => {
    // 4 sao needs 1 point on both branches; 5 sao needs 3 on branch a, 2 on branch b.
    const set = withLevels(qd26Set(26), "8", [level(0, null), level(1, 4), level(2, null, "a"), level(3, 5, "a"), level(2, 5, "b")]);
    expect(rank({ ...topScores(set), "8": 2 }, set).unmet).toEqual([]);
    expect(rank({ ...topScores(set), "8": 1 }, set).unmet).toEqual([{ code: "8", name: NAME_8, star: 5, required: 2, actual: 1 }]);
    expect(rank({ ...topScores(set), "8": 0 }, set).byMinimumStars).toBe(3);
  });
});
