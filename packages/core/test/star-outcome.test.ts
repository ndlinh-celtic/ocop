import { describe, expect, it } from "vitest";
import { sectionOf, starOutcome } from "../src/results/decision-model";

/*
 * GLOSSARY "Kết quả": what a Hạng sao of the kết quả chốt means for the hồ sơ. Below 3 sao is không đạt (Thư kết quả
 * không đạt); 3 and 4 sao are công nhận by the tỉnh; 5 sao is đạt điểm đề nghị Trung ương đánh giá, phân hạng 5 sao.
 */
describe("starOutcome", () => {
  it("is không đạt below 3 sao", () => {
    expect(starOutcome(1)).toBe("not_passed");
    expect(starOutcome(2)).toBe("not_passed");
  });

  it("is công nhận 3 or 4 sao for 3 and 4 sao", () => {
    expect(starOutcome(3)).toBe("three_star");
    expect(starOutcome(4)).toBe("four_star");
  });

  it("is đề nghị Trung ương for 5 sao", () => {
    expect(starOutcome(5)).toBe("five_star_proposal");
  });

  it("gives the mục of a quyết định, none below 3 sao", () => {
    expect([1, 2, 3, 4, 5].map(sectionOf)).toEqual([null, null, "three_star", "four_star", "five_star_proposal"]);
  });
});
