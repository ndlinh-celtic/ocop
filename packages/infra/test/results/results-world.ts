import type { UserActor } from "@ocop/core";
import type { DraftExtras } from "../dossiers/fixtures";
import { scoringWorld } from "../scoring/world";

/**
 * Hồ sơ Đã chốt điểm in one Phiên họp of Hội đồng A, for the Bước 5 tests (#83). Each hồ sơ is graded by thành viên M0
 * and M1 with the điểm given (1.1, 2.1, 3.1): [20,0,35] → 55 (3 sao); [40,25,35] and [20,25,0] → 72,5 (4 sao);
 * [40,25,35] → 100 (5 sao); [20,25,0] → 45 (2 sao, không đạt).
 */
export type Points = [number, number, number];
export const THREE: Points[] = [
  [20, 0, 35],
  [20, 0, 35],
];
export const FOUR: Points[] = [
  [40, 25, 35],
  [20, 25, 0],
];
export const FIVE: Points[] = [
  [40, 25, 35],
  [40, 25, 35],
];
export const TWO: Points[] = [
  [20, 25, 0],
  [20, 25, 0],
];

export function resultsWorld() {
  const w = scoringWorld({ minGraders: 2 });
  const m = (i: number) => w.A.members[i]!;

  async function scoreAndConfirm(actor: UserActor, dossierId: string, [a, b, c]: Points) {
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

  const versionOf = async (dossierId: string) => (await w.t.app.dossiers.get(w.A.secretary, { dossierId })).version;

  /** Hồ sơ Sẵn sàng chốt with these điểm, all in one new open Phiên họp; each Nháp got `draft`. */
  async function meetingOf(recipes: Points[][], draft: DraftExtras = {}) {
    const dossiers: { a: UserActor; dossierId: string }[] = [];
    for (const [p0, p1] of recipes) {
      const d = await w.graded([m(0), m(1)], [], draft);
      await scoreAndConfirm(m(0), d.dossierId, p0!);
      await scoreAndConfirm(m(1), d.dossierId, p1!);
      dossiers.push({ a: d.a, dossierId: d.dossierId });
    }
    const { meetingId } = await w.t.app.scoring.createMeeting(w.A.secretary, {
      roundId: w.roundId,
      title: "Phiên họp xét công nhận",
      heldOn: "2026-10-25",
      location: "Phòng họp Sở",
      dossierIds: dossiers.map((d) => d.dossierId),
    });
    return { meetingId, dossiers };
  }

  const finalize = async (dossierId: string) => w.t.app.scoring.finalize(w.A.secretary, { dossierId, expectedVersion: await versionOf(dossierId) });

  /** A closed Phiên họp whose hồ sơ, given by their điểm, are all chốt. */
  async function closedMeeting(recipes: Points[][], draft: DraftExtras = {}) {
    const meeting = await meetingOf(recipes, draft);
    for (const d of meeting.dossiers) await finalize(d.dossierId);
    await w.t.app.scoring.closeMeeting(w.A.secretary, { meetingId: meeting.meetingId });
    return meeting;
  }

  /** The signed Quyết định công nhận PDF, uploaded by `actor` (the Cán bộ Sở by default). */
  const decisionFile = (actor: UserActor = w.province) => w.f.uploadPdf(actor, "recognition_decision", "QĐ công nhận.pdf");

  async function record(meetingId: string, actor: UserActor = w.province, input: { number?: string; signedOn?: string } = {}) {
    const fileId = await decisionFile(actor.activeRole === "province_officer" ? actor : w.province);
    return w.t.app.results.recordMeetingDecision(actor, {
      meetingId,
      number: input.number ?? "123/QĐ-UBND",
      signedOn: input.signedOn ?? "2026-10-19",
      fileId,
    });
  }

  return { w, m, scoreAndConfirm, versionOf, meetingOf, finalize, closedMeeting, decisionFile, record };
}
