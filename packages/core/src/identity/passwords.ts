import { auditEntry } from "../audit/audit";
import type { ConsumerContext } from "../platform/consumer-context";
import { emit } from "../platform/emit";
import { sendEmail } from "../platform/send-email";
import type { Actor, RequestContext } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { hashToken, newToken } from "../shared/tokens";
import { clearFailures } from "./lockout";
import { assertPasswordAcceptable } from "./password";
import { authorize } from "./policy";
import { isUsable } from "./tokens";

/** Always resolves the same way, so the form does not reveal which emails have accounts. */
export function requestPasswordReset(deps: CoreDeps) {
  return (email: string, ctx: RequestContext): Promise<void> =>
    deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const user = await tx.users.findByEmail(email.trim());
      const anonymous = { kind: "anonymous" as const, ctx };
      await tx.audit.append(
        auditEntry(anonymous, deps.ids.next(), now, {
          action: "identity.password_reset.requested",
          targetType: user ? "user" : null,
          targetId: user?.id ?? null,
          metadata: { email: email.trim().toLowerCase(), known: user?.status === "active" },
        }),
      );
      if (user?.status === "active") await emit(deps, tx, { type: "identity.password_reset.requested", payload: { userId: user.id } });
    });
}

/** Consumer: issues the one-hour reset link when the email goes out; earlier links stop working. */
export async function emailPasswordReset(c: ConsumerContext): Promise<void> {
  if (c.event.type !== "identity.password_reset.requested") return;
  const { deps, tx } = c;
  const user = await tx.users.findById(c.event.payload.userId);
  if (!user || user.status !== "active") return;
  const now = deps.clock.now();
  await tx.oneTimeTokens.invalidateOpen(user.id, "password_reset", now);
  const token = newToken();
  const expiresAt = new Date(now.getTime() + deps.settings.passwordResetTtlMs);
  await tx.oneTimeTokens.insert({
    id: deps.ids.next(),
    userId: user.id,
    purpose: "password_reset",
    tokenHash: hashToken(token),
    createdAt: now,
    expiresAt,
    usedAt: null,
    invalidatedAt: null,
  });
  const link = new URL(`/dat-lai-mat-khau?token=${token}`, deps.settings.appBaseUrl).toString();
  await sendEmail(c, { to: user.email, template: "password_reset", data: { fullName: user.fullName, link, expiresAt } });
}

/** Consumer: tells the owner their account was locked, with a way out if it was not them. */
export async function emailAccountLocked(c: ConsumerContext): Promise<void> {
  if (c.event.type !== "identity.user.locked") return;
  const user = await c.tx.users.findById(c.event.payload.userId);
  if (!user) return;
  await sendEmail(c, {
    to: user.email,
    template: "account_locked",
    data: { fullName: user.fullName, until: new Date(c.event.payload.until), resetLink: new URL("/quen-mat-khau", c.deps.settings.appBaseUrl).toString() },
  });
}

export function resetPassword(deps: CoreDeps) {
  return async (input: { token: string; password: string }, ctx: RequestContext): Promise<{ ok: true } | { ok: false; reason: "invalid_link" }> => {
    assertPasswordAcceptable(input.password);
    const passwordHash = await deps.hasher.hash(input.password);
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const t = await tx.oneTimeTokens.findByHash(hashToken(input.token));
      if (!t || t.purpose !== "password_reset" || !isUsable(t, now)) return { ok: false, reason: "invalid_link" };
      const user = await tx.users.findById(t.userId);
      if (!user || user.status !== "active") return { ok: false, reason: "invalid_link" };
      await tx.oneTimeTokens.markUsed(t.id, now);
      await tx.users.update(user.id, { passwordHash });
      await clearFailures(tx, user);
      await tx.sessions.revokeAllForUser(user.id, now);
      const actor = { kind: "user" as const, userId: user.id, activeRole: null, ctx };
      await tx.audit.append(auditEntry(actor, deps.ids.next(), now, { action: "identity.password.reset", targetType: "user", targetId: user.id }));
      return { ok: true };
    });
  };
}

export function changePassword(deps: CoreDeps) {
  return async (actor: Actor, input: { currentPassword: string; newPassword: string }) => {
    authorize(actor, "password.change_own");
    assertPasswordAcceptable(input.newPassword);
    const passwordHash = await deps.hasher.hash(input.newPassword);
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const user = await tx.users.findById(actor.userId);
      if (!user?.passwordHash || !(await deps.hasher.verify(user.passwordHash, input.currentPassword))) {
        throw new DomainError("wrong_password", "Mật khẩu hiện tại không đúng");
      }
      await tx.users.update(user.id, { passwordHash });
      await tx.sessions.revokeAllForUserExcept(user.id, actor.sessionId, now);
      await tx.audit.append(auditEntry(actor, deps.ids.next(), now, { action: "identity.password.changed", targetType: "user", targetId: user.id }));
    });
  };
}
