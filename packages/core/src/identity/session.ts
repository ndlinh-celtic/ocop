import { auditEntry } from "../audit/audit";
import type { RequestContext, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { hashToken, newToken } from "../shared/tokens";
import type { Tx } from "../shared/uow";
import { isAssignmentActive, type RoleAssignment } from "./model";

export interface SignInInput {
  email: string;
  password: string;
}

export type SignInResult = { ok: true; sessionToken: string; userId: string } | { ok: false; reason: "invalid_credentials" };

/** The Vai trò đang dùng a new session starts with: the only active Phân vai, if there is just one. */
function defaultAssignment(assignments: RoleAssignment[], at: Date): RoleAssignment | null {
  const active = assignments.filter((a) => isAssignmentActive(a, at));
  return active.length === 1 ? active[0]! : null;
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
        return { ok: false, reason: "invalid_credentials" };
      }

      const assignment = defaultAssignment(await tx.roleAssignments.listForUser(user.id), now);
      const token = newToken();
      const sessionId = deps.ids.next();
      await tx.sessions.insert({
        id: sessionId,
        userId: user.id,
        tokenHash: hashToken(token),
        activeAssignmentId: assignment?.id ?? null,
        createdAt: now,
        lastSeenAt: now,
        authenticatedAt: now,
        revokedAt: null,
      });
      const actor = { kind: "user" as const, userId: user.id, activeRole: assignment?.role ?? null, ctx };
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "auth.sign_in.succeeded",
          targetType: "session",
          targetId: sessionId,
          metadata: { method: "password" },
        }),
      );
      return { ok: true, sessionToken: token, userId: user.id };
    });
  };
}

/** Loads the actor behind a session token, or null when the token is unknown, revoked or stale. */
export async function loadActor(tx: Tx, token: string, at: Date, ctx: RequestContext): Promise<UserActor | null> {
  const session = await tx.sessions.findByTokenHash(hashToken(token));
  if (!session || session.revokedAt) return null;
  const user = await tx.users.findById(session.userId);
  if (!user || user.status !== "active") return null;
  const assignment = session.activeAssignmentId ? await tx.roleAssignments.findById(session.activeAssignmentId) : null;
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
  return (token: string, ctx: RequestContext) => deps.uow.run((tx) => loadActor(tx, token, deps.clock.now(), ctx));
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
