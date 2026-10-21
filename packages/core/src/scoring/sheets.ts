import type { Assignment } from "../councils/assignment-model";
import { lockDossier } from "../dossiers/edit";
import { versionConflict, type Dossier, type DossierState } from "../dossiers/model";
import { transition } from "../dossiers/transition";
import { assembleSet, type StoredCriterion } from "../criteria/detail";
import { criteriaOf } from "../criteria/model";
import type { SetRows } from "../criteria/version";
import { authorize } from "../identity/policy";
import { requireRecentAuth } from "../identity/reauth";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { isUuid } from "../shared/ids";
import type { Tx } from "../shared/uow";
import type { ScoreSheet } from "./score-sheet-model";

/*
 * L14 TV-01, TV-05, TV-06, TV-07 (spec #49 stories 83, 86 to 91, 94): a thành viên chấm writes and xác nhận
 * the Phiếu chấm of their own Phân công. The hồ sơ is locked for the write, so writes on it queue; the
 * optimistic lock the thành viên sees is the phiếu's own version, so thành viên chấm the same hồ sơ at once
 * without refusing one another. A phiếu đã xác nhận is never changed (ADR 0008; the database refuses it too).
 */

const MAX_COMMENT = 10_000;

/** The Phân công thành viên chấm of the reader on the hồ sơ, in force, and its Phiếu chấm not superseded. */
export async function ownSheet(tx: Tx, actor: UserActor, dossierId: string): Promise<{ assignment: Assignment | null; sheet: ScoreSheet | null }> {
  const assignment = (await tx.assignments.current(dossierId)).find((a) => a.userId === actor.userId && a.kind === "member" && a.effectiveAt !== null) ?? null;
  const sheet = assignment ? ((await tx.scoreSheets.current(dossierId)).find((s) => s.assignmentId === assignment.id) ?? null) : null;
  return { assignment, sheet };
}

/** The Bộ tiêu chí the hồ sơ is fixed to. */
export async function setRowsOf(tx: Tx, dossier: Dossier): Promise<SetRows> {
  const found = await tx.criteriaVersions.findSet(dossier.criteriaSetId);
  if (!found) throw new Error(`criteria set ${dossier.criteriaSetId} of dossier ${dossier.id} is missing`);
  return found.rows;
}

/** The phiếu the thành viên may still write, at the version they last saw. */
function writable(sheet: ScoreSheet | null, expectedVersion: number): ScoreSheet {
  if (!sheet) throw new DomainError("score_sheet_not_found", "Anh/chị chưa có Phiếu chấm cho hồ sơ này");
  if (sheet.state !== "draft") throw new DomainError("score_sheet_confirmed", "Phiếu chấm đã xác nhận nên không sửa được nữa");
  if (sheet.version !== expectedVersion) throw versionConflict();
  return sheet;
}

export interface ScoreSheetLineInput {
  criterionId: string;
  /** A Mức điểm of the Tiêu chí, "Không đáp ứng, 0 điểm" included; null clears the pick. */
  levelId: string | null;
  comment: string;
  /** Bằng chứng kiểm tra: files the thành viên uploaded with purpose `grading_evidence`; replaces the dòng's list. */
  evidenceFileIds: string[];
  /** TV-04: why a dòng from the Tổ tư vấn leaves its Mức điểm gốc; required then, dropped otherwise. */
  adjustReason?: string | null;
}

export interface SaveScoreSheetInput {
  dossierId: string;
  /** The version of the Phiếu chấm the thành viên last saw. */
  expectedVersion: number;
  /** The dòng to write; a Tiêu chí left out keeps what it has. */
  lines: ScoreSheetLineInput[];
}

/** TV-05 (stories 83, 86, 88): saves dòng of the reader's Phiếu chấm as a nháp; returns the phiếu's new version. */
export function saveScoreSheet(deps: CoreDeps) {
  return async (actor: Actor, input: SaveScoreSheetInput): Promise<{ version: number }> => {
    authorize(actor, "scoring.sheet.write");
    const lines = [...new Map((Array.isArray(input.lines) ? input.lines : []).map((l) => [l.criterionId, l])).values()];
    if (lines.length === 0) throw new DomainError("lines_required", "Chưa có Tiêu chí nào để lưu");
    for (const l of lines) {
      if (typeof l.comment !== "string" || l.comment.length > MAX_COMMENT) throw new DomainError("field_too_long", "Nhận xét quá dài");
      if (!Array.isArray(l.evidenceFileIds)) throw new DomainError("file_not_found", "Không tìm thấy tệp");
      if (l.adjustReason != null && (typeof l.adjustReason !== "string" || l.adjustReason.length > MAX_COMMENT)) throw new DomainError("field_too_long", "Lý do điều chỉnh quá dài");
    }
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const { sheet } = await ownSheet(tx, actor, before.id);
      // transition() first, so a wrong state or Vai trò is reported as such. The hồ sơ version is not the
      // thành viên's concern: the lock queues writers and the phiếu has its own version.
      await transition(deps, tx, actor, before, {
        action: "dossier.score_sheet.edit",
        expectedVersion: before.version,
        metadata: { scoreSheetId: sheet?.id ?? null, criterionIds: lines.map((l) => l.criterionId) },
      });
      const current = writable(sheet, input.expectedVersion);
      const rows = await setRowsOf(tx, before);
      const stored = new Map((await tx.scoreSheets.lines(current.id)).map((l) => [l.criterionId, l]));
      const now = deps.clock.now();
      for (const l of lines) {
        if (!isUuid(l.criterionId) || !rows.criteria.some((c) => c.id === l.criterionId)) {
          throw new DomainError("criterion_not_in_set", "Tiêu chí không thuộc Bộ tiêu chí của hồ sơ");
        }
        if (l.levelId !== null && !rows.levels.some((v) => v.id === l.levelId && v.criterionId === l.criterionId)) {
          throw new DomainError("level_not_in_criterion", "Mức điểm đã chọn không thuộc tiêu chí này");
        }
        const fileIds = [...new Set(l.evidenceFileIds)];
        for (const fileId of fileIds) await assertEvidence(tx, actor, fileId);
        const was = stored.get(l.criterionId);
        // TV-04 (stories 84, 85): leaving the Điểm đề xuất copied from the Tổ tư vấn needs a reason.
        const adjusted = was?.source === "advisory" && l.levelId !== was.advisoryLevelOriginal;
        const adjustReason = adjusted ? (l.adjustReason ?? "").trim() : null;
        if (adjustReason === "") throw adjustReasonRequired([rows.criteria.find((c) => c.id === l.criterionId)!.code]);
        await tx.scoreSheets.saveLine({
          scoreSheetId: current.id,
          criterionId: l.criterionId,
          scoreLevelId: l.levelId,
          comment: l.comment.trim(),
          source: was?.source ?? "member",
          advisoryVersionId: was?.advisoryVersionId ?? null,
          advisoryLevelOriginal: was?.advisoryLevelOriginal ?? null,
          adjustReason,
          edited: true,
          updatedAt: now,
          fileIds,
        });
      }
      const version = current.version + 1;
      if (!(await tx.scoreSheets.update({ ...current, version, updatedAt: now }, current.version))) throw versionConflict();
      return { version };
    });
  };
}

/** A bằng chứng kiểm tra the reader uploaded, not refused by the scan (it may still be scanning). */
async function assertEvidence(tx: Tx, actor: UserActor, fileId: unknown) {
  const file = isUuid(fileId) ? await tx.files.findById(fileId) : null;
  if (!file || file.ownerUserId !== actor.userId || file.purpose !== "grading_evidence") throw new DomainError("file_not_found", "Không tìm thấy tệp");
  if (file.status === "awaiting_upload") throw new DomainError("file_not_ready", "Tệp chưa tải lên xong");
  if (file.status === "blocked") throw new DomainError("file_blocked", "Tệp bị chặn vì không qua được kiểm tra virus");
}

const adjustReasonRequired = (codes: string[]) =>
  new DomainError("adjust_reason_required", `Ghi lý do điều chỉnh khác Điểm đề xuất của Tổ tư vấn: ${codes.join(", ")}`);

/** Story 90: xác nhận refused while Tiêu chí have no Mức điểm; `criteria` lists their mã. */
export class ScoreSheetIncompleteError extends DomainError {
  constructor(readonly criteria: readonly string[]) {
    super("score_sheet_incomplete", `Còn Tiêu chí chưa có Mức điểm: ${criteria.join(", ")}`);
  }
}

/**
 * TV-07 (stories 89 to 91, 94, 96): the thành viên xác nhận their Phiếu chấm after Xác thực lại within 5
 * minutes; the method goes on the phiếu and the audit (ADR 0003). The xác nhận that brings the phiếu đã xác
 * nhận of the Phân công in force to the đợt's người chấm tối thiểu moves the hồ sơ to Thành viên xác nhận (Sẵn
 * sàng chốt); later ones, until chốt, leave it there.
 */
export function confirmScoreSheet(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number }): Promise<{ version: number; dossierState: DossierState }> => {
    authorize(actor, "scoring.sheet.write");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const { sheet } = await ownSheet(tx, actor, before.id);
      const proof = await requireRecentAuth(deps, tx, actor);
      const inForce = new Set((await tx.assignments.current(before.id)).filter((a) => a.kind === "member" && a.effectiveAt !== null).map((a) => a.id));
      const confirmed = (await tx.scoreSheets.current(before.id)).filter((s) => s.state === "confirmed" && inForce.has(s.assignmentId)).length;
      // A hồ sơ in member_review has a đợt.
      const round = before.roundId ? await tx.rounds.findById(before.roundId) : null;
      const ready = before.state === "member_review" && sheet?.state === "draft" && round !== null && confirmed + 1 >= round.aggregation.minGraders;
      const after = await transition(deps, tx, actor, before, {
        action: ready ? "dossier.score_sheet.confirm_ready" : "dossier.score_sheet.confirm",
        expectedVersion: before.version,
        metadata: { scoreSheetId: sheet?.id ?? null, reauth: { at: proof.at.toISOString(), method: proof.method } },
      });
      const current = writable(sheet, input.expectedVersion);
      const lines = new Map((await tx.scoreSheets.lines(current.id)).map((l) => [l.criterionId, l]));
      const rows = await setRowsOf(tx, before);
      const unscored = sheetOrder(rows).filter((c) => !lines.get(c.id)?.scoreLevelId);
      if (unscored.length > 0) throw new ScoreSheetIncompleteError(unscored.map((c) => c.code));
      // Story 90: no điều chỉnh left without its reason (save refuses one already; this holds whatever wrote the dòng).
      const unexplained = sheetOrder(rows).filter((c) => {
        const l = lines.get(c.id);
        return l?.source === "advisory" && l.scoreLevelId !== l.advisoryLevelOriginal && !l.adjustReason;
      });
      if (unexplained.length > 0) throw adjustReasonRequired(unexplained.map((c) => c.code));
      const now = deps.clock.now();
      const version = current.version + 1;
      const done: ScoreSheet = { ...current, state: "confirmed", confirmedAt: now, reauthMethod: proof.method, version, updatedAt: now };
      if (!(await tx.scoreSheets.update(done, current.version))) throw versionConflict();
      return { version, dossierState: after.state };
    });
  };
}

/** The Tiêu chí of a Bộ tiêu chí in sheet order, each with its Phần. */
export function sheetOrder(rows: SetRows): (StoredCriterion & { partCode: string })[] {
  return assembleSet(rows).parts.flatMap((part) => criteriaOf(part).map((c) => ({ ...c, partCode: part.code })));
}
