import { auditEntry } from "../audit/audit";
import type { RequestContext, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { hashToken, newToken } from "../shared/tokens";
import type { Tx } from "../shared/uow";
import { clearFailures, isLocked, registerFailure } from "./lockout";
import { isAssignmentActive, type RoleAssignment, type Session, type SessionStage, type User } from "./model";
import { TOTP_OPTIONAL_ROLES } from "./roles";

/** How long the TOTP step of a sign-in, or a forced enrolment, may take. */
export const PENDING_STAGE_TTL_MS: Record<Exclude<SessionStage, "full">, number> = {
  totp_pending: 5 * 60_000,
  totp_enrollment: 15 * 60_000,
};

export interface SignInInput {
  email: string;
  password: string;
}

export type SignInResult =
  | { ok: true; sessionToken: string; userId: string; stage: SessionStage }
  | { ok: false; reason: "invalid_credentials" }
  | { ok: false; reason: "locked"; until: Date };

/** The Vai trò đang dùng a new session starts with: the only active Phân vai, if there is just one. */
function defaultAssignment(assignments: RoleAssignment[], at: Date): RoleAssignment | null {
  const active = assignments.filter((a) => isAssignmentActive(a, at));
  return active.length === 1 ? active[0]! : null;
}

/** ADR 0003: TOTP is mandatory for anyone holding a Phân vai outside TOTP_OPTIONAL_ROLES. */
export function mustUseTotp(assignments: RoleAssignment[], at: Date, totpRequired: boolean): boolean {
  return totpRequired && assignments.some((a) => isAssignmentActive(a, at) && !TOTP_OPTIONAL_ROLES.includes(a.role));
}

export function stageAfterPassword(user: User, assignments: RoleAssignment[], at: Date, totpRequired: boolean): SessionStage {
  if (user.totpEnabledAt) return "totp_pending";
  return mustUseTotp(assignments, at, totpRequired) ? "totp_enrollment" : "full";
}

export function signIn(deps: CoreDeps) {
  // Verifying against a throwaway hash keeps "unknown email" as slow as "wrong password".
  let dummyHash: Promise<string> | undefined;
  const dummy = () => (dummyHash ??= deps.hasher.hash("ocop-timing-equaliser"));

  return async (input: SignInInput, ctx: RequestContext): Promise<SignInResult> => {
    const email = input.email.trim();
    const anonymous = { kind: "anonymous" as const, ctx };
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const user = await tx.users.findByEmail(email);
      if (user && isLocked(user, now)) {
        await tx.audit.append(
          auditEntry(anonymous, deps.ids.next(), now, {
            action: "auth.sign_in.failed",
            targetType: "user",
            targetId: user.id,
            metadata: { email: email.toLowerCase(), reason: "locked" },
          }),
        );
        return { ok: false, reason: "locked", until: user.lockedUntil! };
      }
      const passwordOk =
        user?.passwordHash != null
          ? await deps.hasher.verify(user.passwordHash, input.password)
          : (await deps.hasher.verify(await dummy(), input.password), false);

      if (!user || !passwordOk || user.status !== "active") {
        await tx.audit.append(
          auditEntry(anonymous, deps.ids.next(), now, {
            action: "auth.sign_in.failed",
            targetType: user ? "user" : null,
            targetId: user?.id ?? null,
            metadata: { email: email.toLowerCase(), reason: !user ? "unknown_email" : !passwordOk ? "wrong_password" : "inactive" },
          }),
        );
        if (user && !passwordOk && (await registerFailure(deps, tx, user, anonymous, now))) {
          return { ok: false, reason: "locked", until: new Date(now.getTime() + deps.settings.lockout.lockMs) };
        }
        return { ok: false, reason: "invalid_credentials" };
      }

      const assignments = await tx.roleAssignments.listForUser(user.id);
      const assignment = defaultAssignment(assignments, now);
      const stage = stageAfterPassword(user, assignments, now, deps.settings.totpRequired);
      // Only a completed sign-in resets the count, so the password step cannot clear TOTP failures.
      if (stage === "full") await clearFailures(tx, user);
      const token = newToken();
      const sessionId = deps.ids.next();
      await tx.sessions.insert({
        id: sessionId,
        stage,
        userId: user.id,
        tokenHash: hashToken(token),
        activeAssignmentId: assignment?.id ?? null,
        createdAt: now,
        lastSeenAt: now,
        authenticatedAt: now,
        authMethod: "password",
        revokedAt: null,
      });
      const actor = { kind: "user" as const, userId: user.id, activeRole: assignment?.role ?? null, ctx };
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: stage === "full" ? "auth.sign_in.succeeded" : "auth.password.verified",
          targetType: "session",
          targetId: sessionId,
          metadata: stage === "full" ? { method: "password" } : { next: stage },
        }),
      );
      return { ok: true, sessionToken: token, userId: user.id, stage };
    });
  };
}

/** A session still in a pending stage, if it exists, is not revoked and has not timed out. */
export async function loadPendingSession(
  tx: Tx,
  token: string,
  at: Date,
  stages: readonly SessionStage[],
): Promise<{ session: Session; user: User } | "expired" | null> {
  const session = await tx.sessions.findByTokenHash(hashToken(token));
  if (!session || session.revokedAt || !stages.includes(session.stage)) return null;
  if (session.stage !== "full" && at.getTime() - session.createdAt.getTime() > PENDING_STAGE_TTL_MS[session.stage]) return "expired";
  const user = await tx.users.findById(session.userId);
  if (!user || user.status !== "active") return null;
  return { session, user };
}

/** Idle limit for this Người dùng: strict as soon as they hold any Vai trò outside TOTP_OPTIONAL_ROLES. */
export function idleLimitMs(assignments: RoleAssignment[], at: Date, settings: CoreDeps["settings"]): number {
  const strict = assignments.some((a) => isAssignmentActive(a, at) && !TOTP_OPTIONAL_ROLES.includes(a.role));
  return strict ? settings.session.idleStrictMs : settings.session.idleRelaxedMs;
}

/** Recording activity at most once a minute keeps authentication cheap. */
const TOUCH_EVERY_MS = 60_000;

/**
 * Loads the actor behind a session token, or null when the token is unknown, revoked, unfinished,
 * idle for too long or past its maximum lifetime.
 */
export async function loadActor(tx: Tx, token: string, at: Date, ctx: RequestContext, settings: CoreDeps["settings"]): Promise<UserActor | null> {
  const loaded = await loadPendingSession(tx, token, at, ["full"]);
  if (!loaded || loaded === "expired") return null;
  const { session, user } = loaded;
  const assignments = await tx.roleAssignments.listForUser(user.id);
  const idle = at.getTime() - session.lastSeenAt.getTime();
  const age = at.getTime() - session.createdAt.getTime();
  if (idle > idleLimitMs(assignments, at, settings) || age > settings.session.maxLifetimeMs) {
    await tx.sessions.revoke(session.id, at);
    return null;
  }
  if (idle > TOUCH_EVERY_MS) await tx.sessions.update(session.id, { lastSeenAt: at });
  const assignment = session.activeAssignmentId ? (assignments.find((a) => a.id === session.activeAssignmentId) ?? null) : null;
  const active = assignment && isAssignmentActive(assignment, at) ? assignment : null;
  return {
    kind: "user",
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    sessionId: session.id,
    activeRole: active?.role ?? null,
    activeAssignmentId: active?.id ?? null,
    activeScope: active ? { type: active.scopeType, id: active.scopeId } : null,
    ctx,
  };
}

export function authenticate(deps: CoreDeps) {
  return (token: string, ctx: RequestContext) => deps.uow.run((tx) => loadActor(tx, token, deps.clock.now(), ctx, deps.settings));
}

export function signOut(deps: CoreDeps) {
  return (actor: UserActor) =>
    deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      await tx.sessions.revoke(actor.sessionId, now);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, { action: "auth.sign_out", targetType: "session", targetId: actor.sessionId }),
      );
    });
}
