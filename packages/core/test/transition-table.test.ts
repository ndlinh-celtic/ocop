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

describe("L16 Quyết định công nhận and Công bố kết quả rows (#83)", () => {
  const rowsOf = (action: string) => TRANSITIONS.filter((r) => r.action === action);
  const dossier = (resultPublishedAt: Date | null) => ({ resultPublishedAt }) as Dossier;
  const published = new Date("2026-10-27T03:00:00Z");

  it("lets only the Cán bộ Sở recognize a hồ sơ Đã chốt điểm, or Công bố it while it stays Đã chốt điểm, both on the timeline", () => {
    expect(rowsOf("dossier.recognize")).toEqual([
      expect.objectContaining({ from: "score_finalized", to: "recognized", roles: ["province_officer"], event: "dossier.result_published", timeline: true }),
    ]);
    expect(rowsOf("dossier.result_publish")).toEqual([
      expect.objectContaining({
        from: "score_finalized",
        to: "score_finalized",
        roles: ["province_officer"],
        event: "dossier.result_published",
        timeline: true,
      }),
    ]);
  });

  it("publishes a hồ sơ once only", () => {
    for (const row of [...rowsOf("dossier.recognize"), ...rowsOf("dossier.result_publish")]) {
      expect(row.guard?.(dossier(null), new Date())).toBeNull();
      expect(row.guard?.(dossier(published), new Date())).toMatchObject({ code: "result_published" });
    }
  });

  it("refuses Mở khóa sau chốt once the kết quả is Công bố (stories 20, 45)", () => {
    const [unlock] = rowsOf("dossier.unlock");
    expect(unlock?.guard?.(dossier(null), new Date())).toBeNull();
    expect(unlock?.guard?.(dossier(published), new Date())).toMatchObject({ code: "result_published" });
  });
});

describe("L17 Đề xuất 5 sao rows (#87, ADR 0009)", () => {
  const rowsOf = (action: string) => TRANSITIONS.filter((r) => r.action === action);
  const dossier = (d: Partial<Dossier>) => ({ resultPublishedAt: null, awaitingSupplementaryDecision: false, ...d }) as Dossier;
  const now = new Date();

  it("lets only the Cán bộ Sở đánh dấu đã gửi, chuyển về and đóng hồ sơ, each a mốc of the timeline", () => {
    expect(rowsOf("dossier.five_star.mark_sent")).toEqual([
      expect.objectContaining({
        from: "score_finalized",
        to: "five_star_proposed",
        roles: ["province_officer"],
        event: "dossier.five_star_sent",
        timeline: true,
      }),
    ]);
    expect(rowsOf("dossier.five_star.return_to_province")).toEqual([
      expect.objectContaining({
        from: "five_star_proposed",
        to: "five_star_proposed",
        roles: ["province_officer"],
        event: "dossier.five_star_returned",
        timeline: true,
      }),
    ]);
    expect(rowsOf("dossier.five_star.close")).toEqual([
      expect.objectContaining({
        from: "five_star_proposed",
        to: "closed_offline",
        roles: ["province_officer"],
        event: "dossier.five_star_closed",
        timeline: true,
      }),
    ]);
  });

  it("sends only a hồ sơ whose kết quả is Công bố", () => {
    const [row] = rowsOf("dossier.five_star.mark_sent");
    expect(row?.guard?.(dossier({}), now)).toMatchObject({ code: "result_not_published" });
    expect(row?.guard?.(dossier({ resultPublishedAt: now }), now)).toBeNull();
  });

  it("neither chuyển về again nor đóng a hồ sơ waiting for its Quyết định công nhận bổ sung", () => {
    for (const row of [...rowsOf("dossier.five_star.return_to_province"), ...rowsOf("dossier.five_star.close")]) {
      expect(row.guard?.(dossier({}), now)).toBeNull();
      expect(row.guard?.(dossier({ awaitingSupplementaryDecision: true }), now)).toMatchObject({ code: "awaiting_supplementary_decision" });
    }
  });
});
