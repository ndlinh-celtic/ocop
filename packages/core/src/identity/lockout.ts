import { auditEntry, type AuditActor } from "../audit/audit";
import { emit } from "../platform/emit";
import type { CoreDeps } from "../shared/deps";
import type { Tx } from "../shared/uow";
import type { User } from "./model";

export const isLocked = (user: User, at: Date) => user.lockedUntil !== null && at < user.lockedUntil;

/**
 * Counts a failed password or TOTP attempt. The window opens at the first failure; reaching the
 * limit inside it locks the account, audits it and emails the owner. Returns true when it locked.
 */
export async function registerFailure(deps: CoreDeps, tx: Tx, user: User, actor: AuditActor, at: Date): Promise<boolean> {
  const { maxFailures, windowMs, lockMs } = deps.settings.lockout;
  const fresh = user.failedWindowStart === null || at.getTime() - user.failedWindowStart.getTime() > windowMs;
  const count = fresh ? 1 : user.failedCount + 1;
  if (count < maxFailures) {
    await tx.users.update(user.id, { failedCount: count, failedWindowStart: fresh ? at : user.failedWindowStart });
    return false;
  }
  const until = new Date(at.getTime() + lockMs);
  await tx.users.update(user.id, { failedCount: 0, failedWindowStart: null, lockedUntil: until });
  await tx.sessions.revokeAllForUser(user.id, at);
  await tx.audit.append(
    auditEntry(actor, deps.ids.next(), at, {
      action: "identity.user.locked",
      targetType: "user",
      targetId: user.id,
      metadata: { until: until.toISOString(), failures: count },
    }),
  );
  await emit(deps, tx, { type: "identity.user.locked", payload: { userId: user.id, until: until.toISOString() } });
  return true;
}

export async function clearFailures(tx: Tx, user: User): Promise<void> {
  if (user.failedCount !== 0 || user.failedWindowStart !== null || user.lockedUntil !== null) {
    await tx.users.update(user.id, { failedCount: 0, failedWindowStart: null, lockedUntil: null });
  }
}
