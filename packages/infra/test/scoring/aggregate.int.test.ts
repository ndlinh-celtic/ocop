import { describe, expect, it } from "vitest";
import type { DossierScores, UserActor } from "@ocop/core";
import { scoringWorld } from "./world";

/*
 * L15 HD-04, HD-05 (#59, spec #49 stories 93, 98 to 101): once the hồ sơ is Sẵn sàng chốt, the điểm tổng hợp is
 * the mean of the phiếu đã xác nhận per Tiêu chí, ranked by rankStars, with a Cờ chênh lệch when the highest and
 * lowest phiếu totals differ by the đợt's ngưỡng or more (15 in the fixtures). The Chủ tịch, Thư ký and every
 * thành viên who confirmed see each phiếu, the tổng hợp and the cờ; a thành viên who has not confirmed sees only theirs.
 * Bộ tiêu chí of the world: 1.1 (A, 0/20/40, Sao tối thiểu 3 needs 20), 2.1 (B, 0/25), 3.1 (C, 0/35); Ngưỡng hạng 30/50/70/90.
 */
describe("L15 Tổng hợp điểm, Cờ chênh lệch and quyền xem đầy đủ (#59)", () => {
  const w = scoringWorld({ minGraders: 3 });
  const m = (i: number) => w.A.members[i]!;

  async function scoreAndConfirm(actor: UserActor, dossierId: string, [a, b, c]: [number, number, number]) {
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "own_sheet") throw new Error(`expected own_sheet, got ${view.kind}`);
    const lines = (
      [
        ["1.1", a],
        ["2.1", b],
        ["3.1", c],
      ] as const
    ).map(([code, points]) => ({ criterionId: w.criterionId(code), levelId: w.level(`${code}:${points}`), comment: "", evidenceFileIds: [] }));
    const { version } = await w.t.app.scoring.saveScoreSheet(actor, { dossierId, expectedVersion: view.sheet!.version, lines });
    await w.t.app.scoring.confirmScoreSheet(actor, { dossierId, expectedVersion: version });
  }

  /** A hồ sơ Sẵn sàng chốt whose three thành viên chấm confirmed these points for 1.1, 2.1 and 3.1. */
  async function ready(sheets: [number, number, number][]) {
    const d = await w.graded([m(0), m(1), m(2)]);
    for (const [i, points] of sheets.entries()) await scoreAndConfirm(m(i), d.dossierId, points);
    return d;
  }

  const full = async (actor: UserActor, dossierId: string) => {
    const view: DossierScores = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "full") throw new Error(`expected full, got ${view.kind}`);
    return view;
  };

  it("averages the phiếu đã xác nhận per Tiêu chí; thirds that add up to 50 still reach the 3-star Ngưỡng hạng (story 98)", async () => {
    const d = await ready([
      [20, 0, 35],
      [20, 0, 35],
      [40, 0, 0],
    ]);

    const { aggregate } = await full(w.A.secretary, d.dossierId);

    expect(aggregate.averages[w.criterionId("1.1")]).toBeCloseTo(26.6667, 4);
    expect(aggregate.averages[w.criterionId("2.1")]).toBe(0);
    expect(aggregate.averages[w.criterionId("3.1")]).toBeCloseTo(23.3333, 4);
    expect(aggregate.total).toBe(50);
    expect(aggregate).toMatchObject({ byThreshold: 3, byMinimumStars: 5, star: 3, unmet: [], sheetCount: 3 });
    expect(aggregate.parts.map((p) => p.code)).toEqual(["A", "B", "C"]);
    expect(aggregate.parts[1]!.total).toBe(0);
  });

  it("caps the Hạng sao at the Sao tối thiểu a Tiêu chí's average misses, though the total reaches the Ngưỡng hạng, and says which (story 99)", async () => {
    const d = await ready([
      [20, 25, 35],
      [0, 25, 35],
      [0, 25, 35],
    ]);

    const { aggregate } = await full(w.A.chair, d.dossierId);

    expect(aggregate.total).toBeCloseTo(66.6667, 4);
    expect(aggregate).toMatchObject({ byThreshold: 3, byMinimumStars: 2, star: 2 });
    expect(aggregate.unmet).toEqual([expect.objectContaining({ code: "1.1", star: 3, required: 20 })]);
    expect(aggregate.unmet[0]!.actual).toBeCloseTo(6.6667, 4);
  });

  it('raises the Cờ chênh lệch when the phiếu totals differ by the đợt\'s ngưỡng or more (story 100, "từ … trở lên")', async () => {
    // The fixtures' ngưỡng is 15, so 10 sits below it and 15 on it.
    const below = await ready([
      [0, 25, 35],
      [40, 25, 0],
      [20, 0, 35],
    ]);
    const atThreshold = await ready([
      [0, 25, 35],
      [0, 25, 35],
      [20, 25, 0],
    ]);

    expect((await full(w.A.secretary, below.dossierId)).aggregate).toMatchObject({ deviation: 10, flagged: false });
    expect((await full(w.A.secretary, atThreshold.dossierId)).aggregate).toMatchObject({ deviation: 15, flagged: true });
    const progress = await w.t.app.scoring.gradingProgress(w.A.chair);
    expect(progress.find((r) => r.dossierId === below.dossierId)?.flagged).toBe(false);
    expect(progress.find((r) => r.dossierId === atThreshold.dossierId)?.flagged).toBe(true);
  });

  it("shows each phiếu, the tổng hợp and the cờ to the Chủ tịch, the Thư ký and every thành viên who confirmed, from Sẵn sàng chốt (story 93)", async () => {
    const d = await w.graded([m(0), m(1), m(2), m(3)]);
    await scoreAndConfirm(m(0), d.dossierId, [40, 25, 35]);
    await scoreAndConfirm(m(1), d.dossierId, [20, 25, 35]);

    // Before Sẵn sàng chốt no thành viên sees another's points; the Chủ tịch sees the phiếu đã xác nhận, no tổng hợp (#68).
    expect((await w.t.app.scoring.readDossierScores(w.A.chair, { dossierId: d.dossierId })).kind).toBe("confirmed_sheets");
    expect((await w.t.app.scoring.readDossierScores(m(0), { dossierId: d.dossierId })).kind).toBe("own_sheet");

    await scoreAndConfirm(m(2), d.dossierId, [20, 0, 35]);
    // m(3) keeps a nháp with points that must not show to anybody else.
    const draft = await w.t.app.scoring.readDossierScores(m(3), { dossierId: d.dossierId });
    if (draft.kind !== "own_sheet") throw new Error("expected own_sheet");
    await w.t.app.scoring.saveScoreSheet(m(3), {
      dossierId: d.dossierId,
      expectedVersion: draft.sheet!.version,
      lines: [{ criterionId: w.criterionId("1.1"), levelId: w.level("1.1:0"), comment: "Chưa xong", evidenceFileIds: [] }],
    });

    const nameOf = (userId: unknown) => w.A.members.find((a) => a.userId === userId)!.fullName;
    for (const who of [w.A.chair, w.A.secretary, m(0), m(1), m(2)]) {
      const view = await full(who, d.dossierId);
      expect(view.dossierState).toBe("member_confirmed");
      expect(view.graders.map((g) => [g.userId, g.state, g.total])).toEqual(
        [
          [m(0).userId, "confirmed", 100],
          [m(1).userId, "confirmed", 80],
          [m(2).userId, "confirmed", 55],
          [m(3).userId, "draft", null],
        ].sort((x, y) => nameOf(x[0]).localeCompare(nameOf(y[0]), "vi")),
      );
      const own = view.graders.find((g) => g.userId === m(1).userId)!;
      expect(own.lines?.map((l) => l.points)).toEqual([20, 25, 35]);
      expect(view.graders.find((g) => g.userId === m(3).userId)!.lines).toBeNull();
      expect(JSON.stringify(view)).not.toContain("Chưa xong");
      // The nháp of m(3) is not counted: (40+20+20)/3 + 25·2/3 + 35 = 78.33.
      expect(view.aggregate).toMatchObject({ sheetCount: 3, star: 4, deviation: 45, flagged: true });
      expect(view.aggregate.total).toBeCloseTo(78.3333, 4);
    }
    // S61 still opens the reader's own phiếu on request; nobody but a thành viên chấm gets one that way.
    expect(await w.t.app.scoring.readDossierScores(m(0), { dossierId: d.dossierId, ownSheet: true })).toMatchObject({
      kind: "own_sheet",
      sheet: { state: "confirmed" },
    });
    expect((await w.t.app.scoring.readDossierScores(w.A.chair, { dossierId: d.dossierId, ownSheet: true })).kind).toBe("full");
    // A thành viên who has not confirmed still sees only their phiếu, though the hồ sơ is Sẵn sàng chốt.
    const mine = await w.t.app.scoring.readDossierScores(m(3), { dossierId: d.dossierId });
    expect(mine.kind).toBe("own_sheet");
    expect(JSON.stringify(mine)).not.toContain(m(0).userId);
    // Outside the Hội đồng nothing changes.
    for (const who of [d.a, w.ward, w.province]) {
      expect(await w.t.app.scoring.readDossierScores(who, { dossierId: d.dossierId })).toEqual({ kind: "none" });
    }
  });
});
