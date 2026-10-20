import { describe, expect, it } from "vitest";
import { placeholderRoundActivity } from "../src/rounds/activity";
import type { Tx } from "../src/shared/uow";

describe("L07 HD-06 placeholder ports until phiếu chấm and hồ sơ exist", () => {
  const tx = {} as Tx;

  it("reports that a round has no phiếu chấm, so Chế độ chấm and Quy tắc tổng hợp stay open", async () => {
    expect(await placeholderRoundActivity.hasScoreSheets(tx, "any-round")).toBe(false);
  });

  it("reports no unfinished hồ sơ, so a round Đã đóng nộp can end", async () => {
    expect(await placeholderRoundActivity.unfinishedDossierCount(tx, "any-round")).toBe(0);
  });
});
