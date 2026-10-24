import { isMemberInForce } from "../councils/assignment-model";
import { createHash } from "node:crypto";
import { auditEntry } from "../audit/audit";
import { lockDossier } from "../dossiers/edit";
import { versionConflict, type DossierState } from "../dossiers/model";
import { transition } from "../dossiers/transition";
import { authorize } from "../identity/policy";
import { requireRecentAuth } from "../identity/reauth";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { canonical } from "../shared/canonical";
import { DomainError, forbidden } from "../shared/errors";
import type { AggregateResult, FinalizedSnapshot, SnapshotGrader } from "./meeting-model";
import { aggregateOf } from "./read";

/*
 * L15 HD-08 (spec #49 "Chốt điểm"; stories 116 to 121, 134): the Chủ tịch or Thư ký chốt điểm a hồ sơ Sẵn sàng chốt
 * that waits in an open Phiên họp, after Xác thực lại. In one transaction: the nháp of every thành viên chấm in force
 * becomes Vắng, the điểm tổng hợp is computed as the views compute it (aggregateOf), the kết quả chốt is written with
 * its snapshot and SHA-256, and the hồ sơ moves to Đã chốt điểm. The kết quả never changes after (ADR 0008).
 */

/** SHA-256 (hex) of the canonical JSON of a snapshot: recomputing it from the stored snapshot gives the stored hash. */
export const snapshotHash = (snapshot: FinalizedSnapshot) => createHash("sha256").update(canonical(snapshot)).digest("hex");

export interface FinalizeResult {
  version: number;
  dossierState: DossierState;
  resultId: string;
  n: number;
  total: number;
  star: number;
}

export function finalizeDossier(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number }): Promise<FinalizeResult> => {
    authorize(actor, "scoring.finalize");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      // Two people chốt from the same screen: the one whose turn comes second saw an older version (story 87).
      if (input.expectedVersion !== before.version) throw versionConflict();
      const proof = await requireRecentAuth(deps, tx, actor);
      const n = (await tx.aggregateResults.list(before.id)).length + 1;
      const pending = await tx.meetings.pendingOf(before.id);
      const after = await transition(deps, tx, actor, before, { action: "dossier.finalize", expectedVersion: input.expectedVersion, metadata: { n } });
      const meeting = pending && (await tx.meetings.findById(pending.meetingId));
      if (!pending || !meeting || meeting.state !== "open") {
        throw new DomainError("not_in_open_meeting", "Hồ sơ chưa thuộc Phiên họp nào đang mở, chưa chốt điểm được");
      }
      if (meeting.councilId !== before.councilId) throw forbidden();

      // Story 118: a phiếu of a Phân công in force not confirmed by now is Vắng.
      const now = deps.clock.now();
      const inForce = new Set((await tx.assignments.current(before.id)).filter(isMemberInForce).map((a) => a.id));
      for (const sheet of await tx.scoreSheets.current(before.id)) {
        if (sheet.state !== "draft" || !inForce.has(sheet.assignmentId)) continue;
        if (!(await tx.scoreSheets.update({ ...sheet, state: "absent", version: sheet.version + 1, updatedAt: now }, sheet.version))) {
          throw versionConflict();
        }
      }

      const { thresholds, graded, aggregation, aggregate } = await aggregateOf(tx, before);
      const round = before.roundId ? await tx.rounds.findById(before.roundId) : null;
      const advisory = (await tx.advisoryReports.versions(before.id)).at(-1) ?? null;
      const snapshotGraders: SnapshotGrader[] = graded.map(({ grader: g, sheet }) => {
        return {
          userId: g.userId,
          fullName: g.fullName,
          sheetId: sheet?.id ?? null,
          attempt: sheet?.attempt ?? null,
          state: g.state,
          confirmedAt: g.confirmedAt?.toISOString() ?? null,
          reauthMethod: sheet?.reauthMethod ?? null,
          total: g.total,
          lines: g.lines,
        };
      });
      const absent = snapshotGraders.flatMap((g) => (g.state === "absent" && g.sheetId ? [{ sheetId: g.sheetId, userId: g.userId, fullName: g.fullName }] : []));
      const counted = snapshotGraders.flatMap((g) => (g.state === "confirmed" && g.sheetId ? [g.sheetId] : []));
      // Through JSON once, so what is hashed is exactly what JSONB keeps (no undefined, no Date).
      const snapshot: FinalizedSnapshot = JSON.parse(
        JSON.stringify({
          n,
          dossier: { id: before.id, code: before.code, productName: before.productName },
          meeting: { id: meeting.id, title: meeting.title, heldOn: meeting.heldOn },
          criteriaVersionId: before.criteriaVersionId,
          criteriaSetId: before.criteriaSetId,
          thresholds,
          aggregation: { method: round?.aggregation.method ?? "mean", ...aggregation },
          advisoryReportVersion: advisory && { id: advisory.id, number: advisory.number },
          graders: snapshotGraders,
          absent,
          aggregate,
          finalizedAt: now.toISOString(),
          finalizedBy: { userId: actor.userId, fullName: actor.fullName },
          reauthMethod: proof.method,
        } satisfies FinalizedSnapshot),
      );
      const result: AggregateResult = {
        id: deps.ids.next(),
        dossierId: before.id,
        n,
        meetingId: meeting.id,
        criteriaVersionId: before.criteriaVersionId,
        total: aggregate.total,
        star: aggregate.star,
        parts: aggregate.parts,
        averages: aggregate.averages,
        unmet: aggregate.unmet,
        deviation: aggregate.deviation,
        flagged: aggregate.flagged,
        countedSheetIds: counted,
        absentSheetIds: absent.map((a) => a.sheetId),
        snapshot,
        sha256: snapshotHash(snapshot),
        finalizedBy: actor.userId,
        finalizedAt: now,
        reauthMethod: proof.method,
        supersededAt: null,
        supersededByUnlock: null,
      };
      await tx.aggregateResults.insert(result);
      await tx.meetings.markFinalized(meeting.id, before.id, result.id);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "scoring.result.finalized",
          targetType: "dossier",
          targetId: before.id,
          after: { resultId: result.id, n, total: result.total, star: result.star, flagged: result.flagged, sha256: result.sha256 },
          metadata: { meetingId: meeting.id, countedSheetIds: counted, absentSheetIds: result.absentSheetIds, reauth: { at: proof.at.toISOString(), method: proof.method } },
        }),
      );
      return { version: after.version, dossierState: after.state, resultId: result.id, n, total: result.total, star: result.star };
    });
  };
}
