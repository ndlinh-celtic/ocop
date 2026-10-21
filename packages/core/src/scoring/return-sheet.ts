import { lockDossier } from "../dossiers/edit";
import { dossierNotFound, type DossierState } from "../dossiers/model";
import { transition } from "../dossiers/transition";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { emit } from "../platform/emit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { ScoreSheet } from "./score-sheet-model";
import { setRowsOf, sheetOrder } from "./sheets";

/*
 * L15 HD-05 Trả phiếu (spec #49 stories 102 to 106, ADR 0008): before chốt, the Chủ tịch or Thư ký gives a thành
 * viên their phiếu back with a lý do. The phiếu is never reopened: it becomes superseded, its content untouched
 * (the database allows nothing else), and lần chấm attempt + 1 opens as a nháp holding the same dòng, with their
 * source, advisory_* and edited, so the thành viên changes only what the thảo luận asked. A phiếu Vắng is returned
 * the same way after a Mở khóa sau chốt, so that its thành viên grades for the first time.
 */

const MAX_REASON = 2_000;
const RETURNABLE: readonly ScoreSheet["state"][] = ["confirmed", "absent"];

export interface ReturnScoreSheetInput {
  dossierId: string;
  /** The phiếu to return, as the Chủ tịch or Thư ký sees it in the full view or the tiến độ. */
  sheetId: string;
  reason: string;
}

export function returnScoreSheet(deps: CoreDeps) {
  return async (actor: Actor, input: ReturnScoreSheetInput): Promise<{ scoreSheetId: string; dossierState: DossierState }> => {
    authorize(actor, "scoring.sheet.return");
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (!reason) throw new DomainError("reason_required", "Cần nêu lý do Trả phiếu");
    if (reason.length > MAX_REASON) throw new DomainError("field_too_long", "Lý do quá dài");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const inForce = (await tx.assignments.current(before.id)).filter((a) => a.kind === "member" && a.effectiveAt !== null);
      const counted = (await tx.scoreSheets.current(before.id)).filter((s) => inForce.some((a) => a.id === s.assignmentId));
      const sheet = counted.find((s) => s.id === input.sheetId) ?? null;
      const left = counted.filter((s) => s.state === "confirmed" && s.id !== sheet?.id).length;
      // A hồ sơ in member_confirmed has a đợt.
      const round = before.roundId ? await tx.rounds.findById(before.roundId) : null;
      const unready = before.state === "member_confirmed" && round !== null && left < round.aggregation.minGraders;
      const newId = deps.ids.next();
      // transition() first, so a wrong state or Vai trò is reported as such. Off the timeline: the audit row keeps
      // whose phiếu and why, the Chủ thể never sees it (story 137).
      const after = await transition(deps, tx, actor, before, {
        action: unready ? "dossier.score_sheet.return_unready" : "dossier.score_sheet.return",
        expectedVersion: before.version,
        reason,
        metadata: { scoreSheetId: input.sheetId, newScoreSheetId: newId, confirmedLeft: left },
      });
      if (!sheet) throw new DomainError("score_sheet_not_found", "Không tìm thấy Phiếu chấm này của hồ sơ");
      if (!RETURNABLE.includes(sheet.state)) throw new DomainError("score_sheet_not_returnable", "Chỉ Trả phiếu được phiếu đã xác nhận hoặc phiếu Vắng");
      const member = inForce.find((a) => a.id === sheet.assignmentId)!;
      if (!(await tx.scoreSheets.supersede(sheet.id, newId, reason))) {
        throw new DomainError("score_sheet_not_returnable", "Chỉ Trả phiếu được phiếu đã xác nhận hoặc phiếu Vắng");
      }
      const now = deps.clock.now();
      await tx.scoreSheets.insert({
        id: newId,
        dossierId: before.id,
        assignmentId: sheet.assignmentId,
        attempt: sheet.attempt + 1,
        state: "draft",
        confirmedAt: null,
        reauthMethod: null,
        supersededBy: null,
        supersededReason: null,
        awaitingCopy: sheet.awaitingCopy,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      for (const line of await tx.scoreSheets.lines(sheet.id)) await tx.scoreSheets.saveLine({ ...line, scoreSheetId: newId, updatedAt: now });
      await emit(deps, tx, {
        type: "scoring.score_sheet_returned",
        payload: { dossierId: before.id, entityId: before.entityId, scoreSheetId: sheet.id, newScoreSheetId: newId, userId: member.userId, reason },
      });
      return { scoreSheetId: newId, dossierState: after.state };
    });
  };
}

/** A phiếu bị thay thế, as the Chủ tịch and Thư ký read it in the lịch sử (story 104). */
export interface SupersededSheet {
  sheetId: string;
  userId: string;
  fullName: string;
  attempt: number;
  /** Null for a phiếu that was Vắng. */
  confirmedAt: Date | null;
  reason: string | null;
  /** When the lần chấm that replaced it opened, i.e. when it was returned. */
  returnedAt: Date;
  /** Tổng điểm of its dòng; a Tiêu chí without Mức điểm counts 0. */
  total: number;
  lines: { criterionId: string; code: string; levelId: string | null; points: number | null; comment: string; adjustReason: string | null; source: "member" | "advisory" }[];
}

/**
 * Story 104: the phiếu a Trả phiếu superseded on a hồ sơ (its thành viên since thay or not), unchanged, newest first, for the
 * Chủ tịch and Thư ký only; nobody else reads them (spec #49 "chỉ hiện trong lịch sử cho Chủ tịch/Thư ký").
 */
export function scoreSheetHistory(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<SupersededSheet[]> => {
    authorize(actor, "scoring.sheet.return");
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(dataScopeOf(actor), input.dossierId);
      if (!dossier) throw dossierNotFound();
      const order = sheetOrder(await setRowsOf(tx, dossier));
      const pointsOf = new Map(order.flatMap((c) => c.levels.map((l) => [l.id, l.points] as const)));
      const assignments = [...(await tx.assignments.current(dossier.id)), ...(await tx.assignments.replaced(dossier.id))];
      const members = new Map(assignments.filter((a) => a.kind === "member").map((a) => [a.id, a.userId]));
      const sheets = await tx.scoreSheets.all(dossier.id);
      const byId = new Map(sheets.map((s) => [s.id, s]));
      const out: SupersededSheet[] = [];
      for (const s of [...sheets].reverse()) {
        const userId = members.get(s.assignmentId);
        // A Trả phiếu supersedes a phiếu by the next lần chấm of the same Phân công; a thay (#55) supersedes the old
        // thành viên's nháp by the newcomer's phiếu, which the Phân công history (assignmentHistory) shows instead.
        const successor = s.supersededBy ? byId.get(s.supersededBy) : undefined;
        if (s.state !== "superseded" || !userId || successor?.assignmentId !== s.assignmentId) continue;
        const byCriterion = new Map((await tx.scoreSheets.lines(s.id)).map((l) => [l.criterionId, l]));
        const lines = order.flatMap((c) => {
          const l = byCriterion.get(c.id);
          if (!l) return [];
          const points = l.scoreLevelId ? (pointsOf.get(l.scoreLevelId) ?? null) : null;
          return [{ criterionId: c.id, code: c.code, levelId: l.scoreLevelId, points, comment: l.comment, adjustReason: l.adjustReason, source: l.source }];
        });
        out.push({
          sheetId: s.id,
          userId,
          fullName: (await tx.users.findById(userId))?.fullName ?? "",
          attempt: s.attempt,
          confirmedAt: s.confirmedAt,
          reason: s.supersededReason,
          returnedAt: successor.createdAt,
          total: lines.reduce((sum, l) => sum + (l.points ?? 0), 0),
          lines,
        });
      }
      return out;
    });
  };
}
