import { describe, expect, it } from "vitest";
import { snapshotHash, type DossierScores, type UserActor } from "@ocop/core";
import { scoringWorld } from "./world";

/*
 * L15 HD-08, TV-08 (#60, spec #49 stories 107 to 109, 116 to 126): the Chủ tịch or Thư ký lập a Phiên họp of
 * the Hội đồng in a đợt with hồ sơ Sẵn sàng chốt, then chốt each one after Xác thực lại. A phiếu not confirmed
 * by then is Vắng; the kết quả chốt keeps the điểm tổng hợp, Hạng sao, unmet Sao tối thiểu, Cờ chênh lệch, the
 * phiếu counted, a snapshot and its SHA-256, and never changes (ADR 0008). The hồ sơ goes to Đã chốt điểm.
 * Bộ tiêu chí of the world: 1.1 (A, 0/20/40, Sao tối thiểu 3 needs 20), 2.1 (B, 0/25), 3.1 (C, 0/35).
 */
describe("L15 Phiên họp and chốt điểm (#60)", () => {
  const w = scoringWorld({ minGraders: 2 });
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

  /** A hồ sơ Giao chấm to thành viên 0, 1 and 2, of whom 0 and 1 confirmed (Sẵn sàng chốt) and 2 left a nháp. */
  async function ready() {
    const d = await w.graded([m(0), m(1), m(2)]);
    await scoreAndConfirm(m(0), d.dossierId, [40, 25, 35]);
    await scoreAndConfirm(m(1), d.dossierId, [20, 25, 0]);
    return d;
  }

  const full = async (actor: UserActor, dossierId: string) => {
    const view: DossierScores = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "full") throw new Error(`expected full, got ${view.kind}`);
    return view;
  };

  const meetingWith = (actor: UserActor, dossierIds: string[]) =>
    w.t.app.scoring.createMeeting(actor, { roundId: w.roundId, title: "Phiên họp thứ nhất", heldOn: "2026-10-25", location: "Phòng họp Sở", dossierIds });

  it("chốt a hồ sơ of an open Phiên họp: Đã chốt điểm, the nháp is Vắng, and the kết quả is stored with its hash (stories 116 to 120)", async () => {
    const d = await ready();
    await meetingWith(w.A.secretary, [d.dossierId]);
    const before = await full(w.A.secretary, d.dossierId);

    const done = await w.t.app.scoring.finalize(w.A.secretary, { dossierId: d.dossierId, expectedVersion: before.dossierVersion });

    expect(done).toMatchObject({ n: 1, star: 4, total: 72.5 });
    const after = await full(w.A.secretary, d.dossierId);
    expect(after.dossierState).toBe("score_finalized");
    expect(after.aggregate).toMatchObject({ total: 72.5, star: 4, sheetCount: 2, deviation: 55, flagged: true });
    expect(after.graders.find((g) => g.userId === m(2).userId)).toMatchObject({ state: "absent", total: null });
    expect(after.result).toMatchObject({ n: 1, reauthMethod: "password", finalizedBy: { userId: w.A.secretary.userId } });
    expect(after.result!.absent).toEqual([expect.objectContaining({ userId: m(2).userId })]);
    expect(snapshotHash(after.result!.snapshot)).toBe(after.result!.sha256);
  });
});
