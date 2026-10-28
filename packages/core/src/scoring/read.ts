import { isMemberInForce } from "../councils/assignment-model";
import type { CriteriaSetDetail } from "../criteria/detail";
import { assembleSet } from "../criteria/detail";
import type { RankThresholds } from "../criteria/model";
import { rankStoredSet, type StoredStarRank } from "../criteria/star-rank";
import { DOSSIER_STATES, dossierNotFound, type Dossier, type DossierState } from "../dossiers/model";
import { auditEntry } from "../audit/audit";
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
import type { AggregateResult, FinalizedSnapshot } from "./meeting-model";
import { underperformingCriteria, type UnderperformingCriterion } from "../results/underperforming";
import { underperformingRatioIn } from "../system/settings";
import type { ResultOutcome } from "../platform/events";

/*
 * Who sees which points of a hồ sơ (spec #49 "Tổng hợp, Cờ chênh lệch, quyền xem điểm"; stories 92, 93, 95, 98, 124, 132).
 * The rule lives in one function, `scoresVisibility`; `readDossierScores` builds what it allows. Quyền xem điểm follows
 * the chủ đầu tư's answers (`docs/to-questionnaire-so-nnmt-hoi-dong-va-ket-qua.md`, GLOSSARY.md), so change it there and nowhere else.
 */

export type ScoresVisibility = "confirmed_sheets" | "own_sheet" | "full" | "aggregate_only" | "published_result" | "none";

/** Sẵn sàng chốt and every state after chốt (a Mở khóa sau chốt goes back to Sẵn sàng chốt). */
const READY_OR_LATER: readonly DossierState[] = DOSSIER_STATES.slice(DOSSIER_STATES.indexOf("member_confirmed"));

export interface VisibilityFacts {
  role: Role | null;
  state: DossierState;
  /** Whether the reader's own Phiếu chấm in force is confirmed; only asked of a Thành viên hội đồng. */
  ownSheetConfirmed: boolean;
  /** S61 asks a thành viên's own phiếu, whatever else they may see. */
  ownSheetOnly?: boolean;
  /** Whether the hồ sơ has a kết quả chốt hiện hành (#60); a Mở khóa sau chốt supersedes it. */
  finalized?: boolean;
  /** Whether its kết quả is Công bố (#83): `result_published_at` set. */
  published?: boolean;
}

/**
 * The kind of score view a Vai trò đang dùng gets of a hồ sơ already loaded within its Phạm vi. The Chủ tịch and
 * Thư ký see each phiếu as soon as it is confirmed, and the tổng hợp from Sẵn sàng chốt (#68, chủ đầu tư's answer
 * in `docs/to-questionnaire-so-nnmt-hoi-dong-va-ket-qua.md`); a thành viên sees their own phiếu, and everything
 * once both their phiếu is confirmed and the hồ sơ is Sẵn sàng chốt (L15 step 4 "họp xem điểm của nhau").
 */
export function scoresVisibility({
  role,
  state,
  ownSheetConfirmed,
  ownSheetOnly = false,
  finalized = false,
  published = false,
}: VisibilityFacts): ScoresVisibility {
  const ready = READY_OR_LATER.includes(state);
  switch (role) {
    case "council_chair":
    case "council_secretary":
      return ready || finalized ? "full" : "confirmed_sheets";
    case "council_member":
      // After chốt every thành viên chấm of the hồ sơ sees the kết quả and each phiếu, a Vắng included (story 122, TV-08).
      return !ownSheetOnly && (finalized || (ready && ownSheetConfirmed)) ? "full" : "own_sheet";
    case "advisory_member":
      // Story 123: the Tổ tư vấn sees the kết quả chốt, never a thành viên's phiếu.
      return finalized ? "aggregate_only" : "none";
    case "province_officer":
      // L16 (#80, spec #79 story 68): the Sở sees the kết quả chốt hiện hành, with Tiêu chí dưới mức, never a phiếu.
      return finalized ? "aggregate_only" : "none";
    case "entity_owner":
      // L16 CT-13 (#83, spec #79 stories 62, 64, 65): the Chủ thể sees its kết quả from Công bố kết quả, never a phiếu.
      return finalized && published ? "published_result" : "none";
    default:
      // Cán bộ xã, Quản trị (stories 124, 125, 132; spec #79 story 69).
      return "none";
  }
}

/** A Vai trò that may read any score view loads the hồ sơ first; the others get `none` without a lookup. */
const COUNCIL_READERS: readonly Role[] = ["council_chair", "council_secretary", "council_member", "advisory_member"];
/** readDossierScores' readers: the Hội đồng, the Sở from chốt (#80), the Chủ thể from Công bố kết quả (#83). */
const SCORE_READERS: readonly Role[] = [...COUNCIL_READERS, "province_officer", "entity_owner"];

export interface GraderProgress {
  userId: string;
  fullName: string;
  state: ScoreSheetState | null;
  confirmedAt: Date | null;
  /** The phiếu not superseded, for Trả phiếu (#61); null before the thành viên has one. */
  sheetId: string | null;
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
  sheet: Pick<ScoreSheet, "id" | "state" | "attempt" | "version" | "confirmedAt" | "reauthMethod" | "awaitingCopy"> | null;
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
  /** The hồ sơ version chốt điểm must name (story 87). */
  dossierVersion: number;
  minGraders: number;
  deviationFlagPoints: number;
  set: CriteriaSetDetail;
  thresholds: RankThresholds;
  criteria: { criterionId: string; code: string; name: string; partCode: string; maxPoints: number }[];
  graders: GraderScores[];
  /** Điểm tổng hợp, Hạng sao and Cờ chênh lệch of the phiếu đã xác nhận, computed now, never stored before chốt; after chốt, the stored one. */
  aggregate: AggregateScores;
  /** The kết quả chốt hiện hành, from which `graders` and `aggregate` then come; null before chốt. */
  result: FinalizedResultView | null;
}

/** A kết quả chốt as its readers see it (story 119). */
export interface FinalizedResultView {
  id: string;
  n: number;
  meetingId: string;
  finalizedAt: Date;
  finalizedBy: { userId: string; fullName: string };
  reauthMethod: "totp" | "password";
  sha256: string;
  absent: { userId: string; fullName: string }[];
  snapshot: FinalizedSnapshot;
}

/** Story 123: the Tổ tư vấn's view after chốt, the kết quả without any thành viên's phiếu. */
export interface AggregateOnlyView {
  kind: "aggregate_only";
  dossierId: string;
  dossierState: DossierState;
  set: CriteriaSetDetail;
  thresholds: RankThresholds;
  criteria: FullScoresView["criteria"];
  aggregate: AggregateScores;
  result: { n: number; finalizedAt: Date; sha256: string };
  /** L16 (#80, story 37): the Tiêu chí dưới mức of the kết quả chốt, for the Sở; null for the Tổ tư vấn. */
  underperforming: UnderperformingCriterion[] | null;
}

/** #68: the Chủ tịch and Thư ký before Sẵn sàng chốt, each phiếu đã xác nhận with its dòng, no tổng hợp nor Cờ chênh lệch. */
export type ConfirmedSheetsView = Pick<FullScoresView, "dossierId" | "dossierState" | "minGraders" | "set" | "thresholds" | "criteria" | "graders"> & {
  kind: "confirmed_sheets";
};

/**
 * L16 CT-13 (#83, spec #79 stories 60, 62, 65): what the Chủ thể sees from Công bố kết quả. Only the kết quả chốt hiện
 * hành as a whole and the Nhận xét chung: no phiếu, no thành viên, no Báo cáo Tổ tư vấn, no Tiêu chí dưới mức.
 */
export interface PublishedResultView {
  kind: "published_result";
  dossierId: string;
  dossierState: DossierState;
  publishedAt: Date;
  total: number;
  /** Điểm theo Phần A, B, C. */
  parts: { code: string; total: number }[];
  /** Hạng sao of the kết quả chốt. */
  star: number;
  outcome: ResultOutcome;
  /** Hạng công nhận (ADR 0009) once recognized; null otherwise. */
  recognizedStar: number | null;
  /** How the app words the kết quả: "Công nhận 4 sao", "Đạt điểm, tỉnh đề nghị Trung ương đánh giá 5 sao", "Không đạt". */
  standing: string;
  generalComment: string | null;
}

export type DossierScores = { kind: "none" } | ConfirmedSheetsView | OwnSheetView | FullScoresView | AggregateOnlyView | PublishedResultView;

/** The score view of a hồ sơ the reader is allowed (story 92, 95): see `scoresVisibility`. */
export function readDossierScores(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; ownSheet?: boolean }): Promise<DossierScores> => {
    if (actor.kind !== "user") throw forbidden();
    // Quản trị reads no hồ sơ at all (story 83, 132): it gets `none` like any Vai trò outside the Hội đồng.
    if (!actor.activeRole || !SCORE_READERS.includes(actor.activeRole)) return { kind: "none" };
    authorize(actor, "dossier.read");
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(dataScopeOf(actor), input.dossierId);
      if (!dossier) throw dossierNotFound();
      const { visibility, result } = await visibilityOf(tx, actor, dossier, input.ownSheet === true);
      switch (visibility) {
        case "confirmed_sheets": {
          const { set, thresholds, order, graders, aggregation } = await aggregateOf(tx, dossier);
          await auditViewed(deps, tx, actor, dossier.id, "confirmed_sheets", graders);
          return {
            kind: "confirmed_sheets",
            dossierId: dossier.id,
            dossierState: dossier.state,
            minGraders: aggregation.minGraders,
            set,
            thresholds,
            criteria: criteriaOf(order),
            graders,
          };
        }
        case "full": {
          const view = result ? await finalizedView(tx, dossier, result) : await fullView(tx, dossier);
          await auditViewed(deps, tx, actor, dossier.id, "full", view.graders);
          return view;
        }
        case "aggregate_only": {
          const full = await finalizedView(tx, dossier, result!);
          return {
            kind: "aggregate_only",
            dossierId: dossier.id,
            dossierState: dossier.state,
            set: full.set,
            thresholds: full.thresholds,
            criteria: full.criteria,
            aggregate: full.aggregate,
            result: { n: result!.n, finalizedAt: result!.finalizedAt, sha256: result!.sha256 },
            underperforming: actor.activeRole === "province_officer" ? underperformingCriteria(result!, full.set, await underperformingRatioIn(tx)) : null,
          };
        }
        case "published_result":
          return publishedResultView(tx, dossier, result!);
        case "own_sheet":
          return ownSheetView(tx, actor, dossier);
        case "none":
          return { kind: "none" };
      }
    });
  };
}

/** The reader's `scoresVisibility` of a hồ sơ, with the kết quả chốt hiện hành it was decided on (null before chốt). */
async function visibilityOf(tx: Tx, actor: UserActor, dossier: Dossier, ownSheetOnly: boolean) {
  const ownSheetConfirmed = actor.activeRole === "council_member" && (await ownSheet(tx, actor, dossier.id)).sheet?.state === "confirmed";
  const result = await tx.aggregateResults.current(dossier.id);
  return {
    visibility: scoresVisibility({
      role: actor.activeRole,
      state: dossier.state,
      ownSheetConfirmed,
      ownSheetOnly,
      finalized: result !== null,
      published: dossier.resultPublishedAt !== null,
    }),
    result,
  };
}

export interface AggregateSummaryRow {
  dossierId: string;
  code: string;
  productName: string;
  state: DossierState;
  total: number;
  star: number;
  flagged: boolean;
}

/**
 * S63 list (L15 TV-08; story 93, #73): the tổng hợp of each hồ sơ the reader sees in `full`, without the phiếu nor who
 * chấm them, so opening the list is no personal data access; the detail page is (`readDossierScores`).
 */
export function aggregateSummaries(deps: CoreDeps) {
  return async (actor: Actor): Promise<AggregateSummaryRow[]> => {
    if (actor.kind !== "user") throw forbidden();
    if (!actor.activeRole || !COUNCIL_READERS.includes(actor.activeRole)) return [];
    authorize(actor, "dossier.read");
    return deps.uow.run(async (tx) => {
      const out: AggregateSummaryRow[] = [];
      // `full` needs Sẵn sàng chốt or a kết quả chốt, which only a hồ sơ from Sẵn sàng chốt on has: skip the rest unread.
      for (const d of (await tx.dossiers.list(dataScopeOf(actor), {})).filter((d) => READY_OR_LATER.includes(d.state))) {
        const { visibility, result } = await visibilityOf(tx, actor, d, false);
        if (visibility !== "full") continue;
        const { total, star, flagged } = result ? result.snapshot.aggregate : (await aggregateOf(tx, d)).aggregate;
        out.push({ dossierId: d.id, code: d.code, productName: d.productName, state: d.state, total, star, flagged });
      }
      return out;
    });
  };
}

/**
 * A thành viên's points shown with their name to another reader: a personal data access (NĐ 13/2023, CODING_STANDARDS.md
 * "Truy cập dữ liệu cá nhân"). A view whose only phiếu đã xác nhận is the reader's own, or has none, writes nothing.
 */
async function auditViewed(
  deps: CoreDeps,
  tx: Tx,
  actor: UserActor,
  dossierId: string,
  view: Extract<ScoresVisibility, "confirmed_sheets" | "full">,
  graders: GraderScores[],
) {
  if (!graders.some((g) => g.lines !== null && g.userId !== actor.userId)) return;
  await tx.audit.append(
    auditEntry(actor, deps.ids.next(), deps.clock.now(), { action: "personal_data.viewed", targetType: "dossier", targetId: dossierId, metadata: { view } }),
  );
}

/** Each thành viên chấm in force with their phiếu (not superseded), by name. */
export async function gradersOf(tx: Tx, dossierId: string): Promise<{ progress: GraderProgress; sheet: ScoreSheet | null }[]> {
  const members = (await tx.assignments.current(dossierId)).filter(isMemberInForce);
  const sheets = await tx.scoreSheets.current(dossierId);
  const rows: { progress: GraderProgress; sheet: ScoreSheet | null }[] = [];
  for (const a of members) {
    const sheet = sheets.find((s) => s.assignmentId === a.id) ?? null;
    const user = await tx.users.findById(a.userId);
    rows.push({
      progress: {
        userId: a.userId,
        fullName: user?.fullName ?? "",
        state: sheet?.state ?? null,
        sheetId: sheet?.id ?? null,
        confirmedAt: sheet?.confirmedAt ?? null,
      },
      sheet,
    });
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
export async function aggregateOf(tx: Tx, dossier: Dossier) {
  const rows = await setRowsOf(tx, dossier);
  const set = assembleSet(rows);
  const thresholds = await tx.criteriaVersions.thresholds(dossier.criteriaVersionId);
  const round = dossier.roundId ? await tx.rounds.findById(dossier.roundId) : null;
  const aggregation = { minGraders: round?.aggregation.minGraders ?? 0, deviationFlagPoints: round?.aggregation.deviationFlagPoints ?? 0 };
  const order = sheetOrder(rows);
  const pointsOf = new Map(order.flatMap((c) => c.levels.map((l) => [l.id, l.points] as const)));
  const graded: { grader: GraderScores; sheet: ScoreSheet | null }[] = [];
  const counted: Map<string, number>[] = [];
  for (const { progress, sheet } of await gradersOf(tx, dossier.id)) {
    if (sheet?.state !== "confirmed") {
      graded.push({ grader: { ...progress, total: null, lines: null }, sheet });
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
    graded.push({ grader: { ...progress, total: rankStoredSet({ set, thresholds, scores }).total, lines }, sheet });
  }
  const aggregate = aggregateScores({ set, thresholds, sheets: counted, deviationFlagPoints: aggregation.deviationFlagPoints });
  return { set, thresholds, order, graders: graded.map((g) => g.grader), graded, aggregation, aggregate };
}

const criteriaOf = (order: ReturnType<typeof sheetOrder>): FullScoresView["criteria"] =>
  order.map((c) => ({ criterionId: c.id, code: c.code, name: c.name, partCode: c.partCode, maxPoints: c.maxPoints }));

async function fullView(tx: Tx, dossier: Dossier): Promise<FullScoresView> {
  const { set, thresholds, order, graders, aggregation, aggregate } = await aggregateOf(tx, dossier);
  return {
    kind: "full",
    dossierId: dossier.id,
    dossierState: dossier.state,
    dossierVersion: dossier.version,
    ...aggregation,
    set,
    thresholds,
    criteria: criteriaOf(order),
    graders,
    aggregate,
    result: null,
  };
}

/** After chốt (story 122): the kết quả chốt hiện hành as stored, never recomputed. */
async function finalizedView(tx: Tx, dossier: Dossier, result: AggregateResult): Promise<FullScoresView> {
  const rows = await setRowsOf(tx, dossier);
  const { snapshot } = result;
  return {
    kind: "full",
    dossierId: dossier.id,
    dossierState: dossier.state,
    dossierVersion: dossier.version,
    minGraders: snapshot.aggregation.minGraders,
    deviationFlagPoints: snapshot.aggregation.deviationFlagPoints,
    set: assembleSet(rows),
    thresholds: snapshot.thresholds,
    criteria: criteriaOf(sheetOrder(rows)),
    graders: snapshot.graders.map((g) => ({
      userId: g.userId,
      fullName: g.fullName,
      sheetId: g.sheetId,
      state: g.state,
      confirmedAt: g.confirmedAt ? new Date(g.confirmedAt) : null,
      total: g.total,
      lines: g.lines,
    })),
    aggregate: snapshot.aggregate,
    result: {
      id: result.id,
      n: result.n,
      meetingId: result.meetingId,
      finalizedAt: result.finalizedAt,
      finalizedBy: snapshot.finalizedBy,
      reauthMethod: result.reauthMethod,
      sha256: result.sha256,
      absent: snapshot.absent.map(({ userId, fullName }) => ({ userId, fullName })),
      snapshot,
    },
  };
}

/** The Chủ thể's kết quả: its mục in the newest Quyết định công nhận naming it decides the outcome; none is không đạt. */
async function publishedResultView(tx: Tx, dossier: Dossier, result: AggregateResult): Promise<PublishedResultView> {
  const section = (await tx.recognitionDecisions.ofDossier(dossier.id)).at(-1)?.section ?? null;
  const recognizedStar = section === "three_star" ? 3 : section === "four_star" ? 4 : null;
  const outcome: ResultOutcome = recognizedStar !== null ? "recognized" : section === "five_star_proposal" ? "five_star_proposal" : "not_passed";
  return {
    kind: "published_result",
    dossierId: dossier.id,
    dossierState: dossier.state,
    publishedAt: dossier.resultPublishedAt!,
    total: result.total,
    parts: result.parts.map((p) => ({ code: p.code, total: p.total })),
    star: result.star,
    outcome,
    recognizedStar,
    standing:
      outcome === "recognized" ? `Công nhận ${recognizedStar} sao` : outcome === "five_star_proposal" ? await fiveStarStanding(tx, dossier) : "Không đạt",
    generalComment: dossier.generalComment,
  };
}

/** Spec #79 story 60: how a hồ sơ 5 sao Công bố reads to its Chủ thể. */
export const FIVE_STAR_STANDING = "Đạt điểm, tỉnh đề nghị Trung ương đánh giá 5 sao";

/** Story 60 (#87): where a hồ sơ 5 sao stands after Công bố: sent to the Bộ, chuyển về, or closed on the Bộ's answer. */
async function fiveStarStanding(tx: Tx, dossier: Dossier): Promise<string> {
  if (dossier.state === "five_star_proposed") {
    return dossier.awaitingSupplementaryDecision ? "Trung ương chuyển về, chờ tỉnh công nhận 4 sao" : "Tỉnh đã gửi đề nghị Trung ương đánh giá 5 sao";
  }
  if (dossier.state === "closed_offline") {
    const closure = await tx.fiveStar.closureOf(dossier.id);
    return closure?.outcome === "ministry_recognized_5_star" ? "Bộ công nhận 5 sao" : "Đã đóng theo văn bản của Bộ";
  }
  return FIVE_STAR_STANDING;
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
          ? {
              versionId: line.advisoryVersionId,
              number: numberOf.get(line.advisoryVersionId) ?? 0,
              levelId: original.id,
              points: original.points,
              description: original.description,
            }
          : null,
      adjustReason: line?.adjustReason ?? null,
    };
  });
  const set = assembleSet(rows);
  const scores = new Map(criteria.flatMap((c) => (c.points === null ? [] : [[c.criterionId, c.points] as const])));
  return {
    kind: "own_sheet",
    dossierId: dossier.id,
    sheet: sheet && {
      id: sheet.id,
      state: sheet.state,
      attempt: sheet.attempt,
      version: sheet.version,
      confirmedAt: sheet.confirmedAt,
      reauthMethod: sheet.reauthMethod,
      awaitingCopy: sheet.awaitingCopy,
    },
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
