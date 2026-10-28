import { describe, expect, it } from "vitest";
import type { Dossier } from "../src/dossiers/model";
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

describe("L16 Nhận xét chung row (#80)", () => {
  const row = TRANSITIONS.find((r) => r.action === "dossier.general_comment.edit");
  const dossier = (resultPublishedAt: Date | null) => ({ resultPublishedAt }) as Dossier;

  it("lets the Chủ tịch and Thư ký edit it on a hồ sơ Đã chốt điểm, off the timeline, as a change of the hồ sơ", () => {
    expect(TRANSITIONS.filter((r) => r.action === "dossier.general_comment.edit").length).toBe(1);
    expect(row).toMatchObject({ from: "score_finalized", to: "score_finalized", roles: ["council_chair", "council_secretary"], timeline: false });
    expect(row?.checkOnly).toBeUndefined();
  });

  it("refuses it once the kết quả is Công bố, with result_published", () => {
    expect(row?.guard?.(dossier(null), new Date())).toBeNull();
    expect(row?.guard?.(dossier(new Date("2026-10-27T03:00:00Z")), new Date())).toMatchObject({ code: "result_published" });
  });
});
