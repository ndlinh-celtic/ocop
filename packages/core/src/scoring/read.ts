import type { CriteriaSetDetail } from "../criteria/detail";
import { assembleSet } from "../criteria/detail";
import type { RankThresholds } from "../criteria/model";
import { rankStoredSet, type StoredStarRank } from "../criteria/star-rank";
import { dossierNotFound, type Dossier, type DossierState } from "../dossiers/model";
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
import { ownSheet, setRowsOf, sheetOrder } from "./sheets";

/*
 * Who sees which points of a hồ sơ (spec #49 "Tổng hợp, Cờ chênh lệch, quyền xem điểm"; stories 92, 95, 124, 132).
 * The rule lives in one function, `scoresVisibility`; `readDossierScores` builds what it allows. Until Sẵn sàng
 * chốt is read (#59), the Chủ tịch and Thư ký see only progress and each thành viên only their own phiếu.
 */

export type ScoresVisibility = "progress_only" | "own_sheet" | "none";

/** The kind of score view a Vai trò đang dùng gets of a hồ sơ already loaded within its Phạm vi. */
export function scoresVisibility(role: Role | null): ScoresVisibility {
  switch (role) {
    case "council_chair":
    case "council_secretary":
      return "progress_only";
    case "council_member":
      return "own_sheet";
    default:
      // Chủ thể, Cán bộ xã, Cán bộ Sở, Quản trị and, until chốt (#60), Tổ tư vấn.
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
  /** L12 (stories 71, 84): the Tổ tư vấn phiên bản the dòng was copied from and its Mức điểm gốc; null for a dòng of the thành viên's own. */
  advisory: { versionId: string; number: number; levelId: string; points: number; description: string } | null;
  /** TV-04 (story 85): why the thành viên moved off the Mức điểm gốc. */
  adjustReason: string | null;
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

export type DossierScores = { kind: "none" } | { kind: "progress_only"; dossierId: string; minGraders: number; progress: GraderProgress[] } | OwnSheetView;

/** The score view of a hồ sơ the reader is allowed (story 92, 95): see `scoresVisibility`. */
export function readDossierScores(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<DossierScores> => {
    if (actor.kind !== "user") throw forbidden();
    // Quản trị reads no hồ sơ at all (story 83, 132): it gets `none` like any Vai trò outside the Hội đồng.
    if (!actor.activeRole || !COUNCIL_READERS.includes(actor.activeRole)) return { kind: "none" };
    authorize(actor, "dossier.read");
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(dataScopeOf(actor), input.dossierId);
      if (!dossier) throw dossierNotFound();
      switch (scoresVisibility(actor.activeRole)) {
        case "progress_only": {
          const round = dossier.roundId ? await tx.rounds.findById(dossier.roundId) : null;
          return { kind: "progress_only", dossierId: dossier.id, minGraders: round?.aggregation.minGraders ?? 0, progress: await progressOf(tx, dossier.id) };
        }
        case "own_sheet":
          return ownSheetView(tx, actor, dossier);
        case "none":
          return { kind: "none" };
      }
    });
  };
}

/** Each thành viên chấm in force with the state of their phiếu, by name; no points. */
async function progressOf(tx: Tx, dossierId: string): Promise<GraderProgress[]> {
  const members = (await tx.assignments.current(dossierId)).filter((a) => a.kind === "member" && a.effectiveAt !== null);
  const sheets = await tx.scoreSheets.current(dossierId);
  const rows: GraderProgress[] = [];
  for (const a of members) {
    const sheet = sheets.find((s) => s.assignmentId === a.id);
    const user = await tx.users.findById(a.userId);
    rows.push({ userId: a.userId, fullName: user?.fullName ?? "", state: sheet?.state ?? null, confirmedAt: sheet?.confirmedAt ?? null });
  }
  return rows.sort((x, y) => x.fullName.localeCompare(y.fullName, "vi"));
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
  const numberOf = new Map((await tx.advisoryReports.versions(dossier.id)).map((v) => [v.id, v.number]));
  const criteria = sheetOrder(rows).map((c): SheetCriterion => {
    const line = lines.get(c.id);
    const level = c.levels.find((l) => l.id === line?.scoreLevelId);
    const original = line?.source === "advisory" ? c.levels.find((l) => l.id === line.advisoryLevelOriginal) : undefined;
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
      advisory:
        original && line?.advisoryVersionId
          ? { versionId: line.advisoryVersionId, number: numberOf.get(line.advisoryVersionId) ?? 0, levelId: original.id, points: original.points, description: original.description }
          : null,
      adjustReason: line?.adjustReason ?? null,
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
        });
      }
      return out;
    });
  };
}
