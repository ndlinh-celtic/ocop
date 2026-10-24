import { describe, expect, it } from "vitest";
import { roundActivity } from "../src/rounds/activity";
import type { Tx } from "../src/shared/uow";

// Both queries are tested on Postgres too: infra test/dossiers/round-end and test/councils/grading-start.
describe("L07 HD-06 RoundActivity reads the đợt's Phiếu chấm and hồ sơ in the caller's transaction", () => {
  it("reports a Phiếu chấm in the đợt, which locks Chế độ chấm and Quy tắc tổng hợp, from the Phiếu chấm repository", async () => {
    const asked: string[] = [];
    const tx = { scoreSheets: { existsInRound: async (roundId: string) => (asked.push(roundId), roundId === "graded") } } as unknown as Tx;

    expect(await roundActivity.hasScoreSheets(tx, "graded")).toBe(true);
    expect(await roundActivity.hasScoreSheets(tx, "fresh")).toBe(false);
    expect(asked).toEqual(["graded", "fresh"]);
  });
});
