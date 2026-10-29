import { describe, expect, it } from "vitest";
import { recognizedStar } from "../src/results/decision-model";

/*
 * GLOSSARY "Hạng công nhận", ADR 0009 (#88): the Hạng sao printed on the Giấy chứng nhận equals the Hạng sao of the kết
 * quả chốt, except a hồ sơ 5 sao the Bộ trả về, which the tỉnh công nhận 4 sao. The kết quả chốt itself never changes.
 */
describe("recognizedStar", () => {
  it("is the Hạng sao of the kết quả chốt for 3 and 4 sao", () => {
    expect(recognizedStar({ star: 3 }, false)).toBe(3);
    expect(recognizedStar({ star: 4 }, false)).toBe(4);
  });

  it("is 4 for a hồ sơ 5 sao the Bộ trả về", () => {
    expect(recognizedStar({ star: 5 }, true)).toBe(4);
  });

  it("is none for a hồ sơ 5 sao still đề nghị Trung ương: the tỉnh does not công nhận 5 sao", () => {
    expect(recognizedStar({ star: 5 }, false)).toBeNull();
  });

  it("is none below 3 sao (không đạt)", () => {
    expect(recognizedStar({ star: 2 }, false)).toBeNull();
    expect(recognizedStar({ star: 1 }, true)).toBeNull();
  });

  it("does not lower a hồ sơ 3 or 4 sao even if flagged as trả về", () => {
    expect(recognizedStar({ star: 3 }, true)).toBe(3);
    expect(recognizedStar({ star: 4 }, true)).toBe(4);
  });
});
