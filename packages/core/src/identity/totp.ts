import { auditEntry } from "../audit/audit";
import type { RequestContext } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { loadPendingSession } from "./session";

export type TotpStepResult = { ok: true } | { ok: false; reason: "invalid_code" | "expired" };

const ISSUER_LABEL = "OCOP";

/** Second step of sign-in for a Người dùng who has TOTP. */
export function verifySignInTotp(deps: CoreDeps) {
  return (sessionToken: string, code: string, ctx: RequestContext): Promise<TotpStepResult> =>
    deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const loaded = await loadPendingSession(tx, sessionToken, now, ["totp_pending"]);
      if (loaded === "expired") return { ok: false, reason: "expired" };
      if (!loaded || !loaded.user.totpSecretEnc) return { ok: false, reason: "invalid_code" };
      const { session, user } = loaded;
      const secretEnc = loaded.user.totpSecretEnc;
      const actor = { kind: "user" as const, userId: user.id, activeRole: null, ctx };

      const check = await deps.totp.verify(deps.secretBox.open(secretEnc), code.trim(), now, user.totpLastStep);
      if (!check.valid) {
        await tx.audit.append(auditEntry(actor, deps.ids.next(), now, { action: "auth.totp.failed", targetType: "session", targetId: session.id }));
        return { ok: false, reason: "invalid_code" };
      }
      await tx.users.update(user.id, { totpLastStep: check.step });
      await tx.sessions.update(session.id, { stage: "full", authenticatedAt: now, lastSeenAt: now });
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "auth.sign_in.succeeded",
          targetType: "session",
          targetId: session.id,
          metadata: { method: "password+totp" },
        }),
      );
      return { ok: true };
    });
}

/**
 * Starts (or restarts) TOTP enrolment: a session forced to enrol, or a full session whose
 * Người dùng opts in. Returns the secret once, for the QR code; it is stored sealed.
 */
export function startTotpEnrollment(deps: CoreDeps) {
  return (sessionToken: string, _ctx: RequestContext) =>
    deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const loaded = await loadPendingSession(tx, sessionToken, now, ["totp_enrollment", "full"]);
      if (!loaded || loaded === "expired") throw new DomainError("session_invalid", "Phiên đăng nhập đã hết hạn");
      if (loaded.user.totpEnabledAt) throw new DomainError("totp_already_enabled", "Tài khoản đã bật xác thực hai lớp");
      const secret = deps.totp.generateSecret();
      await tx.users.update(loaded.user.id, { totpPendingSecretEnc: deps.secretBox.seal(secret) });
      return { secret, otpauthUri: deps.totp.keyUri(`${ISSUER_LABEL}:${loaded.user.email}`, secret) };
    });
}

/** Confirms enrolment with a first valid code; a forced-enrolment session becomes usable. */
export function confirmTotpEnrollment(deps: CoreDeps) {
  return (sessionToken: string, code: string, ctx: RequestContext): Promise<TotpStepResult> =>
    deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const loaded = await loadPendingSession(tx, sessionToken, now, ["totp_enrollment", "full"]);
      if (loaded === "expired") return { ok: false, reason: "expired" };
      if (!loaded || !loaded.user.totpPendingSecretEnc) return { ok: false, reason: "invalid_code" };
      const { session, user } = loaded;
      const actor = { kind: "user" as const, userId: user.id, activeRole: null, ctx };
      const secretEnc = loaded.user.totpPendingSecretEnc;

      const check = await deps.totp.verify(deps.secretBox.open(secretEnc), code.trim(), now, null);
      if (!check.valid) {
        await tx.audit.append(auditEntry(actor, deps.ids.next(), now, { action: "auth.totp.failed", targetType: "user", targetId: user.id, metadata: { during: "enrollment" } }));
        return { ok: false, reason: "invalid_code" };
      }
      await tx.users.update(user.id, { totpSecretEnc: secretEnc, totpPendingSecretEnc: null, totpEnabledAt: now, totpLastStep: check.step });
      if (session.stage !== "full") await tx.sessions.update(session.id, { stage: "full", authenticatedAt: now, lastSeenAt: now });
      await tx.audit.append(auditEntry(actor, deps.ids.next(), now, { action: "identity.totp.enrolled", targetType: "user", targetId: user.id }));
      if (session.stage !== "full") {
        await tx.audit.append(
          auditEntry(actor, deps.ids.next(), now, {
            action: "auth.sign_in.succeeded",
            targetType: "session",
            targetId: session.id,
            metadata: { method: "password+totp_enrollment" },
          }),
        );
      }
      return { ok: true };
    });
}

/** What the TOTP pages need to render for an unfinished session. */
export function pendingSignIn(deps: CoreDeps) {
  return (sessionToken: string) =>
    deps.uow.run(async (tx) => {
      const loaded = await loadPendingSession(tx, sessionToken, deps.clock.now(), ["totp_pending", "totp_enrollment"]);
      if (!loaded || loaded === "expired") return null;
      return { stage: loaded.session.stage, email: loaded.user.email };
    });
}
