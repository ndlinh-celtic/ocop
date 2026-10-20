import { describe, expect, it } from "vitest";
import { roundActivity } from "../src/rounds/activity";
import type { Tx } from "../src/shared/uow";

// The count of hồ sơ chưa xong is real from #44 and tested on Postgres (infra test/dossiers/round-end).
describe("L07 HD-06 placeholder port until phiếu chấm exist", () => {
  const tx = {} as Tx;

  it("reports that a round has no phiếu chấm, so Chế độ chấm and Quy tắc tổng hợp stay open", async () => {
    expect(await roundActivity.hasScoreSheets(tx, "any-round")).toBe(false);
  });
});
