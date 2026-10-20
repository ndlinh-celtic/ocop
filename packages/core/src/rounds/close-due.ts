import { auditEntry } from "../audit/audit";
import { emit } from "../platform/emit";
import type { SystemActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import type { Round } from "./model";

/**
 * L07 worker job (every minute): once Hạn nộp xã has passed, a round Đang nhận nộp becomes Đã đóng nộp
 * without anyone acting. Several rounds may sit in Đã đóng nộp together. Idempotent: a closed round no
 * longer matches, so a second run changes nothing and emits nothing. A system use case: no `authorize`.
 */
export function closeDueSubmissions(deps: CoreDeps) {
  return (actor: SystemActor): Promise<{ closed: string[] }> =>
    deps.uow.run(async (tx) => {
      const now = deps.clock.now();
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
      return { closed: due.map((r) => r.id) };
    });
}
