import { describe, expect, it } from "vitest";
import { TRANSITIONS } from "../src/dossiers/transitions";

/*
 * The transition table (spec #30, CLAUDE.md "State machine hồ sơ") as data: a nháp with its own version is a checkOnly
 * row, which only assertTransitionAllowed takes, so saving it never bumps the hồ sơ version others hold (PR #65 lỗi 1).
 */

describe("transition table", () => {
  const checkOnly = TRANSITIONS.filter((r) => r.checkOnly);

  it("marks the nháp saves checkOnly: Phiếu chấm and Báo cáo Tổ tư vấn", () => {
    expect([...new Set(checkOnly.map((r) => r.action))].sort()).toEqual(["dossier.advisory_report.edit", "dossier.score_sheet.edit"]);
  });

  it("keeps every checkOnly row same-state, off the timeline, and outside Nhập hộ and lookup", () => {
    for (const r of checkOnly) {
      expect({ action: r.action, to: r.to, timeline: r.timeline, onBehalf: r.onBehalf, lookup: r.lookup }).toEqual({
        action: r.action,
        to: r.from,
        timeline: false,
        onBehalf: undefined,
        lookup: undefined,
      });
    }
  });

  it("marks an action checkOnly in every state it has a row for, or in none", () => {
    for (const action of new Set(TRANSITIONS.map((r) => r.action))) {
      const rows = TRANSITIONS.filter((r) => r.action === action);
      expect({ action, mixed: new Set(rows.map((r) => r.checkOnly === true)).size > 1 }).toEqual({ action, mixed: false });
    }
  });
});
