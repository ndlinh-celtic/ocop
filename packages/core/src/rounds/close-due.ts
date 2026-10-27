import { auditEntry } from "../audit/audit";
import { emit } from "../platform/emit";
import { type Actor, type SystemActor, systemActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import type { Tx } from "../shared/uow";
import type { Round } from "./model";

/**
 * L07 worker job (every minute): once Hạn nộp xã has passed, a round Đang nhận nộp becomes Đã đóng nộp
 * without anyone acting. Several rounds may sit in Đã đóng nộp together. Idempotent: a closed round no
 * longer matches, so a second run changes nothing and emits nothing. A system use case: no `authorize`.
 */
export function closeDueSubmissions(deps: CoreDeps) {
  return (actor: SystemActor): Promise<{ closed: string[] }> => deps.uow.run(async (tx) => ({ closed: await closeDueInTx(deps, tx, actor, deps.clock.now()) }));
}

/** The job's Name, recorded as the actor of a close, whether the job or openRound ran it. */
export const CLOSE_DUE_ACTOR = "rounds.close-due";

/**
 * Closes, inside the caller's transaction, every round Đang nhận nộp whose Hạn nộp xã is before `now`, with
 * the same audit row and round.submission_closed event as the job. openRound calls it before the one-open
 * rule, so a round overdue but not yet closed by the job (≤ 1 minute) does not block it. Returns the closed round ids, oldest deadline first.
 */
export async function closeDueInTx(deps: CoreDeps, tx: Tx, actor: SystemActor, now: Date): Promise<string[]> {
  const due = await tx.rounds.lockDueForClosing(now);
  for (const before of due) {
    const after: Round = { ...before, status: "submission_closed", submissionClosedAt: now, updatedAt: now };
    await tx.rounds.update(after);
    const submissionDeadline = after.submissionDeadline.toISOString();
    await tx.audit.append(
      auditEntry(actor, deps.ids.next(), now, {
        action: "round.submission_closed",
        targetType: "round",
        targetId: after.id,
        before: { status: before.status },
        after: { status: after.status, submissionClosedAt: now.toISOString() },
        metadata: { submissionDeadline },
      }),
    );
    await emit(deps, tx, { type: "round.submission_closed", payload: { roundId: after.id, submissionDeadline, closedAt: now.toISOString() } });
  }
  return due.map((r) => r.id);
}

/** The system actor for a close that a person's action triggered: it keeps that request's context. */
export const closeDueActorFor = (actor: Actor): SystemActor => systemActor(CLOSE_DUE_ACTOR, actor.ctx);
