import { auditEntry } from "../audit/audit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import type { Tx } from "../shared/uow";
import { clearFailures, isLocked, registerFailure } from "./lockout";
import type { AuthMethod } from "./model";
import { authorize } from "./policy";

/** Xác thực lại stays valid this long (CLAUDE.md: step-up within 5 minutes). */
export const REAUTH_WINDOW_MS = 5 * 60_000;

export interface ReauthProof {
  at: Date;
  /** The strongest factor of the last proof: a sign-in with password + TOTP counts as `totp`. */
  method: "totp" | "password";
}

/**
 * Guard for sensitive use cases (xác nhận phiếu, chốt điểm): refuses unless the session proved
 * its identity within the window. The proof goes into the action's audit row.
 */
export async function requireRecentAuth(deps: CoreDeps, tx: Tx, actor: Extract<Actor, { kind: "user" }>): Promise<ReauthProof> {
  const session = await tx.sessions.findById(actor.sessionId);
  const now = deps.clock.now();
  if (!session || session.revokedAt || now.getTime() - session.authenticatedAt.getTime() > REAUTH_WINDOW_MS) {
    throw new DomainError("reauth_required", "Xác thực lại để tiếp tục");
  }
  return { at: session.authenticatedAt, method: session.authMethod === "password" ? "password" : "totp" };
}

export type ReauthResult = { ok: true } | { ok: false; reason: "invalid" | "totp_required" | "locked" };

/**
 * Xác thực lại: a TOTP code for anyone who has TOTP; the password only when TOTP is not mandatory
 * for the deployment (ADR 0003) and the user has none. Failures count towards the lockout.
 */
export function reauthenticate(deps: CoreDeps) {
  return async (actor: Actor, proof: { code?: string; password?: string }): Promise<ReauthResult> => {
    authorize(actor, "reauth.own");
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const user = await tx.users.findById(actor.userId);
      if (!user) return { ok: false, reason: "invalid" };
      if (isLocked(user, now)) return { ok: false, reason: "locked" };

      let method: AuthMethod;
      let ok: boolean;
      if (user.totpSecretEnc) {
        if (!proof.code) return { ok: false, reason: "totp_required" };
        const check = await deps.totp.verify(deps.secretBox.open(user.totpSecretEnc), proof.code.trim(), now, user.totpLastStep);
        ok = check.valid;
        if (check.valid) await tx.users.update(user.id, { totpLastStep: check.step });
        method = "totp";
      } else {
        if (deps.settings.totpRequired) return { ok: false, reason: "totp_required" };
        if (!proof.password || !user.passwordHash) return { ok: false, reason: "invalid" };
        ok = await deps.hasher.verify(user.passwordHash, proof.password);
        method = "password";
      }

      if (!ok) {
        await tx.audit.append(auditEntry(actor, deps.ids.next(), now, { action: "auth.reauth.failed", targetType: "session", targetId: actor.sessionId, metadata: { method } }));
        return (await registerFailure(deps, tx, user, actor, now)) ? { ok: false, reason: "locked" } : { ok: false, reason: "invalid" };
      }
      await clearFailures(tx, user);
      await tx.sessions.update(actor.sessionId, { authenticatedAt: now, authMethod: method });
      await tx.audit.append(auditEntry(actor, deps.ids.next(), now, { action: "auth.reauthenticated", targetType: "session", targetId: actor.sessionId, metadata: { method } }));
      return { ok: true };
    });
  };
}

/**
 * The sample sensitive action of step 1. It does nothing but prove the guard end to end;
 * xác nhận phiếu and chốt điểm reuse requireRecentAuth in step 4.
 */
export function sensitiveSample(deps: CoreDeps) {
  return async (actor: Actor) => {
    authorize(actor, "reauth.own");
    return deps.uow.run(async (tx) => {
      const proof = await requireRecentAuth(deps, tx, actor);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), deps.clock.now(), {
          action: "identity.sensitive_sample",
          targetType: "session",
          targetId: actor.sessionId,
          metadata: { reauth: { at: proof.at.toISOString(), method: proof.method } },
        }),
      );
      return proof;
    });
  };
}
