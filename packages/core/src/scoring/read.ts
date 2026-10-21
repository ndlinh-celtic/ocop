import type { CriteriaSetDetail } from "../criteria/detail";
import { assembleSet } from "../criteria/detail";
import type { RankThresholds } from "../criteria/model";
import { rankStoredSet, type StoredStarRank } from "../criteria/star-rank";
import { DOSSIER_STATES, dossierNotFound, type Dossier, type DossierState } from "../dossiers/model";
import { authorize } from "../identity/policy";
import type { Role } from "../identity/roles";
import { dataScopeOf } from "../identity/scope";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { forbidden } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import type { FileStatus } from "../files/model";
import type { ScoreSheet, ScoreSheetState } from "./score-sheet-model";
import { aggregateScores, type AggregateScores } from "./aggregate";
import { ownSheet, setRowsOf, sheetOrder } from "./sheets";

/*
 * Who sees which points of a hồ sơ (spec #49 "Tổng hợp, Cờ chênh lệch, quyền xem điểm"; stories 92, 93, 95, 98, 124, 132).
 * The rule lives in one function, `scoresVisibility`; `readDossierScores` builds what it allows. Quyền xem điểm is an
 * open assumption (CLAUDE.md) to check against the quy chế hội đồng, so change it there and nowhere else.
 */

export type ScoresVisibility = "progress_only" | "own_sheet" | "full" | "none";

/** Sẵn sàng chốt and every state after chốt (a Mở khóa sau chốt goes back to Sẵn sàng chốt). */
const READY_OR_LATER: readonly DossierState[] = DOSSIER_STATES.slice(DOSSIER_STATES.indexOf("member_confirmed"));

export interface VisibilityFacts {
  role: Role | null;
  state: DossierState;
  /** Whether the reader's own Phiếu chấm in force is confirmed; only asked of a Thành viên hội đồng. */
  ownSheetConfirmed: boolean;
  /** S61 asks a thành viên's own phiếu, whatever else they may see. */
  ownSheetOnly?: boolean;
}

/**
 * The kind of score view a Vai trò đang dùng gets of a hồ sơ already loaded within its Phạm vi. The Chủ tịch and
 * Thư ký see progress only until Sẵn sàng chốt, then everything; a thành viên sees their own phiếu, and everything
 * once both their phiếu is confirmed and the hồ sơ is Sẵn sàng chốt (L15 step 4 "họp xem điểm của nhau").
 */
export function scoresVisibility({ role, state, ownSheetConfirmed, ownSheetOnly = false }: VisibilityFacts): ScoresVisibility {
  const ready = READY_OR_LATER.includes(state);
  switch (role) {
    case "council_chair":
    case "council_secretary":
      return ready ? "full" : "progress_only";
    case "council_member":
      return ready && ownSheetConfirmed && !ownSheetOnly ? "full" : "own_sheet";
    default:
      // Chủ thể, Cán bộ xã, Cán bộ Sở, Quản trị and, until chốt (#60, aggregate_only), Tổ tư vấn.
      return "none";
  }
}

/** A Vai trò that may read any score view loads the hồ sơ first; the others get `none` without a lookup. */
const COUNCIL_READERS: readonly Role[] = ["council_chair", "council_secretary", "council_member", "advisory_member"];

export interface GraderProgress {
  userId: string;
  fullName: string;
  state: ScoreSheetState | null;
  confirmedAt: Date | null;
}

export interface SheetCriterion {
  criterionId: string;
  code: string;
  name: string;
  partCode: string;
  maxPoints: number;
  levels: { id: string; description: string; points: number; minimumStar: number | null; branch: string | null }[];
  levelId: string | null;
  points: number | null;
  comment: string;
  files: { fileId: string; fileName: string; status: FileStatus }[];
  source: "member" | "advisory";
  edited: boolean;
}

export interface OwnSheetView {
  kind: "own_sheet";
  dossierId: string;
  /** Null when the reader has no Phiếu chấm (not yet given one). */
  sheet: Pick<ScoreSheet, "id" | "state" | "attempt" | "version" | "confirmedAt" | "reauthMethod"> | null;
  set: CriteriaSetDetail;
  thresholds: RankThresholds;
  criteria: SheetCriterion[];
  /** Tổng Phần A/B/C, tổng and Hạng sao ước lượng of the phiếu; a Tiêu chí without Mức điểm counts 0. */
  estimate: StoredStarRank;
  /** Mã of the Tiêu chí without a Mức điểm, in sheet order. */
  unscored: string[];
}

/** One thành viên chấm in force in the `full` view; points only for a phiếu đã xác nhận (a nháp stays private). */
export interface GraderScores extends GraderProgress {
  /** Tổng điểm of the phiếu đã xác nhận, else null. */
  total: number | null;
  /** The dòng in sheet order of a phiếu đã xác nhận, else null. */
  lines: { criterionId: string; levelId: string | null; points: number; comment: string; adjustReason: string | null; source: "member" | "advisory" }[] | null;
}

export interface FullScoresView {
  kind: "full";
  dossierId: string;
  dossierState: DossierState;
  minGraders: number;
  deviationFlagPoints: number;
  set: CriteriaSetDetail;
  thresholds: RankThresholds;
  criteria: { criterionId: string; code: string; name: string; partCode: string; maxPoints: number }[];
  graders: GraderScores[];
  /** Điểm tổng hợp, Hạng sao and Cờ chênh lệch of the phiếu đã xác nhận, computed now, never stored before chốt. */
  aggregate: AggregateScores;
}

export type DossierScores = { kind: "none" } | { kind: "progress_only"; dossierId: string; minGraders: number; progress: GraderProgress[] } | OwnSheetView | FullScoresView;

/** The score view of a hồ sơ the reader is allowed (story 92, 95): see `scoresVisibility`. */
export function readDossierScores(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; ownSheet?: boolean }): Promise<DossierScores> => {
    if (actor.kind !== "user") throw forbidden();
    // Quản trị reads no hồ sơ at all (story 83, 132): it gets `none` like any Vai trò outside the Hội đồng.
    if (!actor.activeRole || !COUNCIL_READERS.includes(actor.activeRole)) return { kind: "none" };
    authorize(actor, "dossier.read");
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(dataScopeOf(actor), input.dossierId);
      if (!dossier) throw dossierNotFound();
      const ownSheetConfirmed = actor.activeRole === "council_member" && (await ownSheet(tx, actor, dossier.id)).sheet?.state === "confirmed";
      switch (scoresVisibility({ role: actor.activeRole, state: dossier.state, ownSheetConfirmed, ownSheetOnly: input.ownSheet === true })) {
        case "progress_only": {
          const round = dossier.roundId ? await tx.rounds.findById(dossier.roundId) : null;
          return { kind: "progress_only", dossierId: dossier.id, minGraders: round?.aggregation.minGraders ?? 0, progress: await progressOf(tx, dossier.id) };
        }
        case "full":
          return fullView(tx, dossier);
        case "own_sheet":
          return ownSheetView(tx, actor, dossier);
        case "none":
          return { kind: "none" };
      }
    });
  };
}

/** Each thành viên chấm in force with their phiếu (not superseded), by name. */
async function gradersOf(tx: Tx, dossierId: string): Promise<{ progress: GraderProgress; sheet: ScoreSheet | null }[]> {
  const members = (await tx.assignments.current(dossierId)).filter((a) => a.kind === "member" && a.effectiveAt !== null);
  const sheets = await tx.scoreSheets.current(dossierId);
  const rows: { progress: GraderProgress; sheet: ScoreSheet | null }[] = [];
  for (const a of members) {
    const sheet = sheets.find((s) => s.assignmentId === a.id) ?? null;
    const user = await tx.users.findById(a.userId);
    rows.push({ progress: { userId: a.userId, fullName: user?.fullName ?? "", state: sheet?.state ?? null, confirmedAt: sheet?.confirmedAt ?? null }, sheet });
  }
  return rows.sort((x, y) => x.progress.fullName.localeCompare(y.progress.fullName, "vi"));
}

/** Each thành viên chấm in force with the state of their phiếu, by name; no points. */
async function progressOf(tx: Tx, dossierId: string): Promise<GraderProgress[]> {
  return (await gradersOf(tx, dossierId)).map((g) => g.progress);
}

/**
 * HD-04, HD-05 (stories 93, 98 to 100): every thành viên chấm in force with the points of their phiếu đã xác nhận,
 * and the điểm tổng hợp of those phiếu. A nháp, a Vắng or a phiếu bị thay thế shows its state and no points.
 */
async function aggregateOf(tx: Tx, dossier: Dossier) {
  const rows = await setRowsOf(tx, dossier);
  const set = assembleSet(rows);
  const thresholds = await tx.criteriaVersions.thresholds(dossier.criteriaVersionId);
  const round = dossier.roundId ? await tx.rounds.findById(dossier.roundId) : null;
  const aggregation = { minGraders: round?.aggregation.minGraders ?? 0, deviationFlagPoints: round?.aggregation.deviationFlagPoints ?? 0 };
  const order = sheetOrder(rows);
  const pointsOf = new Map(order.flatMap((c) => c.levels.map((l) => [l.id, l.points] as const)));
  const graders: GraderScores[] = [];
  const counted: Map<string, number>[] = [];
  for (const { progress, sheet } of await gradersOf(tx, dossier.id)) {
    if (sheet?.state !== "confirmed") {
      graders.push({ ...progress, total: null, lines: null });
      continue;
    }
    const byCriterion = new Map((await tx.scoreSheets.lines(sheet.id)).map((l) => [l.criterionId, l]));
    const lines = order.flatMap((c) => {
      const l = byCriterion.get(c.id);
      if (!l) return [];
      const points = l.scoreLevelId ? (pointsOf.get(l.scoreLevelId) ?? 0) : 0;
      return [{ criterionId: c.id, levelId: l.scoreLevelId, points, comment: l.comment, adjustReason: l.adjustReason, source: l.source }];
    });
    const scores = new Map(lines.map((l) => [l.criterionId, l.points]));
    counted.push(scores);
    graders.push({ ...progress, total: rankStoredSet({ set, thresholds, scores }).total, lines });
  }
  const aggregate = aggregateScores({ set, thresholds, sheets: counted, deviationFlagPoints: aggregation.deviationFlagPoints });
  return { set, thresholds, order, graders, aggregation, aggregate };
}

async function fullView(tx: Tx, dossier: Dossier): Promise<FullScoresView> {
  const { set, thresholds, order, graders, aggregation, aggregate } = await aggregateOf(tx, dossier);
  return {
    kind: "full",
    dossierId: dossier.id,
    dossierState: dossier.state,
    ...aggregation,
    set,
    thresholds,
    criteria: order.map((c) => ({ criterionId: c.id, code: c.code, name: c.name, partCode: c.partCode, maxPoints: c.maxPoints })),
    graders,
    aggregate,
  };
}

async function ownSheetView(tx: Tx, actor: UserActor, dossier: Dossier): Promise<OwnSheetView> {
  const { sheet } = await ownSheet(tx, actor, dossier.id);
  const rows = await setRowsOf(tx, dossier);
  const thresholds = await tx.criteriaVersions.thresholds(dossier.criteriaVersionId);
  const lines = new Map((sheet ? await tx.scoreSheets.lines(sheet.id) : []).map((l) => [l.criterionId, l]));
  const fileOf = new Map<string, { fileName: string; status: FileStatus }>();
  for (const id of new Set([...lines.values()].flatMap((l) => l.fileIds))) {
    const f = await tx.files.findById(id);
    if (f) fileOf.set(id, { fileName: f.fileName, status: f.status });
  }
  const criteria = sheetOrder(rows).map((c): SheetCriterion => {
    const line = lines.get(c.id);
    const level = c.levels.find((l) => l.id === line?.scoreLevelId);
    return {
      criterionId: c.id,
      code: c.code,
      name: c.name,
      partCode: c.partCode,
      maxPoints: c.maxPoints,
      levels: c.levels.map((l) => ({ id: l.id, description: l.description, points: l.points, minimumStar: l.minimumStar, branch: l.branch })),
      levelId: level?.id ?? null,
      points: level?.points ?? null,
      comment: line?.comment ?? "",
      files: (line?.fileIds ?? []).flatMap((fileId) => {
        const f = fileOf.get(fileId);
        return f ? [{ fileId, ...f }] : [];
      }),
      source: line?.source ?? "member",
      edited: line?.edited ?? false,
    };
  });
  const set = assembleSet(rows);
  const scores = new Map(criteria.flatMap((c) => (c.points === null ? [] : [[c.criterionId, c.points] as const])));
  return {
    kind: "own_sheet",
    dossierId: dossier.id,
    sheet: sheet && { id: sheet.id, state: sheet.state, attempt: sheet.attempt, version: sheet.version, confirmedAt: sheet.confirmedAt, reauthMethod: sheet.reauthMethod },
    set,
    thresholds,
    criteria,
    estimate: rankStoredSet({ set, thresholds, scores }),
    unscored: criteria.filter((c) => c.levelId === null).map((c) => c.code),
  };
}

const GRADING_STATES: readonly DossierState[] = ["advisory_review", "advisory_report_issued", "member_review", "member_confirmed"];

export interface GradingProgressRow {
  dossierId: string;
  code: string;
  productName: string;
  state: DossierState;
  round: { id: string; name: string } | null;
  /** Thành viên chấm in force, and how many have a phiếu đã xác nhận. */
  graders: number;
  confirmed: number;
  minGraders: number;
  progress: GraderProgress[];
  /** Cờ chênh lệch once the hồ sơ is Sẵn sàng chốt (S42 "Lệch điểm lớn"), else null. */
  flagged: boolean | null;
}

/** S42 (story 97): the tiến độ chấm of every hồ sơ of the reader's Hội đồng between Giao chấm and chốt. */
export function gradingProgress(deps: CoreDeps) {
  return async (actor: Actor, input: { roundId?: string } = {}): Promise<GradingProgressRow[]> => {
    authorize(actor, "scoring.progress.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      const dossiers = (await tx.dossiers.list(scope, input.roundId ? { roundId: input.roundId } : {})).filter((d) => GRADING_STATES.includes(d.state));
      const rounds = new Map<string, { id: string; name: string; minGraders: number } | null>();
      const out: GradingProgressRow[] = [];
      for (const d of dossiers) {
        if (d.roundId && !rounds.has(d.roundId)) {
          const r = await tx.rounds.findById(d.roundId);
          rounds.set(d.roundId, r && { id: r.id, name: r.name, minGraders: r.aggregation.minGraders });
        }
        const round = d.roundId ? (rounds.get(d.roundId) ?? null) : null;
        const progress = await progressOf(tx, d.id);
        const flagged = d.state === "member_confirmed" ? (await aggregateOf(tx, d)).aggregate.flagged : null;
        out.push({
          dossierId: d.id,
          code: d.code,
          productName: d.productName,
          state: d.state,
          round: round && { id: round.id, name: round.name },
          graders: progress.length,
          confirmed: progress.filter((p) => p.state === "confirmed").length,
          minGraders: round?.minGraders ?? 0,
          progress,
          flagged,
        });
      }
      return out;
    });
  };
}
