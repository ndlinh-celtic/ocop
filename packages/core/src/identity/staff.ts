import { auditEntry } from "../audit/audit";
import { emit } from "../platform/emit";
import type { Actor, AnonymousActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import type { Tx } from "../shared/uow";
import { hashToken } from "../shared/tokens";
import { scopeLabel } from "./assignments";
import { isAssignmentActive, type SessionStage, type User } from "./model";
import { openSession } from "./session";
import { authorize } from "./policy";
import { assertPasswordAcceptable } from "./password";
import { isUsable } from "./tokens";

export interface CreateStaffInput {
  email: string;
  fullName: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Quản trị creates an account for an officer; it stays pending until the officer sets a password. */
export function createStaffUser(deps: CoreDeps) {
  return async (actor: Actor, input: CreateStaffInput) => {
    authorize(actor, "user.create");
    const email = input.email.trim();
    const fullName = input.fullName.trim();
    if (!EMAIL.test(email)) throw new DomainError("email_invalid", "Email không hợp lệ");
    if (!fullName) throw new DomainError("full_name_required", "Nhập họ tên");
    return deps.uow.run(async (tx) => {
      if (await tx.users.findByEmail(email)) throw new DomainError("email_taken", "Email đã có tài khoản");
      const now = deps.clock.now();
      const userId = deps.ids.next();
      await tx.users.insert({
        id: userId,
        email,
        fullName,
        passwordHash: null,
        status: "pending_activation",
        createdAt: now,
        totpSecretEnc: null,
        totpEnabledAt: null,
        totpLastStep: null,
        totpPendingSecretEnc: null,
        failedCount: 0,
        failedWindowStart: null,
        lockedUntil: null,
      });
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, { action: "identity.user.created", targetType: "user", targetId: userId, after: { email, fullName } }),
      );
      await emit(deps, tx, { type: "identity.user.created", payload: { userId } });
      return { userId };
    });
  };
}

/** Sends a fresh activation link; the consumer voids the previous one. */
export function resendActivation(deps: CoreDeps) {
  return async (actor: Actor, input: { userId: string }) => {
    const { userId } = input;
    authorize(actor, "user.resend_activation");
    return deps.uow.run(async (tx) => {
      const user = await tx.users.findById(userId);
      if (!user) throw new DomainError("user_not_found", "Không tìm thấy người dùng");
      if (user.status !== "pending_activation") throw new DomainError("already_active", "Tài khoản đã kích hoạt");
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), deps.clock.now(), { action: "identity.activation.requested", targetType: "user", targetId: userId }),
      );
      await emit(deps, tx, { type: "identity.activation.requested", payload: { userId } });
    });
  };
}

async function describeUser(tx: Tx, u: User, now: Date) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    status: u.status,
    totpEnabled: u.totpEnabledAt !== null,
    lockedUntil: u.lockedUntil && u.lockedUntil > now ? u.lockedUntil : null,
    createdAt: u.createdAt,
    assignments: await Promise.all(
      (await tx.roleAssignments.listForUser(u.id)).map(async (a) => ({
        id: a.id,
        role: a.role,
        scopeType: a.scopeType,
        scopeId: a.scopeId,
        scopeLabel: await scopeLabel(tx, a),
        validFrom: a.validFrom,
        validTo: a.validTo,
        active: isAssignmentActive(a, now),
      })),
    ),
  };
}

/** Lists Người dùng with their contact details; the read itself is audited (NĐ 13/2023). */
export function listUsers(deps: CoreDeps) {
  return async (actor: Actor) => {
    authorize(actor, "user.list");
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const users = await Promise.all((await tx.users.list()).map((u) => describeUser(tx, u, now)));
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, { action: "personal_data.viewed", targetType: "user", metadata: { view: "user_list", count: users.length } }),
      );
      return users;
    });
  };
}

/** One Người dùng's details and Phân vai; audited as a personal data access. */
export function getUser(deps: CoreDeps) {
  return async (actor: Actor, input: { userId: string }) => {
    authorize(actor, "user.list");
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const user = await tx.users.findById(input.userId);
      if (!user) throw new DomainError("user_not_found", "Không tìm thấy người dùng");
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, { action: "personal_data.viewed", targetType: "user", targetId: user.id, metadata: { view: "user_detail" } }),
      );
      return describeUser(tx, user, now);
    });
  };
}

/** For the activation page: whose link this is, or null when it cannot be used. */
export function describeActivation(deps: CoreDeps) {
  return (_anonymous: AnonymousActor, input: { token: string }) =>
    deps.uow.run(async (tx) => {
      const t = await tx.oneTimeTokens.findByHash(hashToken(input.token));
      if (!t || t.purpose !== "activation" || !isUsable(t, deps.clock.now())) return null;
      const user = await tx.users.findById(t.userId);
      return user ? { fullName: user.fullName, email: user.email } : null;
    });
}

/** Activation also signs the officer in, into the TOTP enrolment step if their Vai trò needs it (story 15). */
export type ActivationResult = { ok: true; sessionToken: string; stage: SessionStage } | { ok: false; reason: "invalid_link" };

export function activateAccount(deps: CoreDeps) {
  return async (anonymous: AnonymousActor, input: { token: string; password: string }): Promise<ActivationResult> => {
    const { ctx } = anonymous;
    assertPasswordAcceptable(input.password);
    const passwordHash = await deps.hasher.hash(input.password);
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const t = await tx.oneTimeTokens.findByHash(hashToken(input.token));
      if (!t || t.purpose !== "activation" || !isUsable(t, now)) return { ok: false, reason: "invalid_link" };
      const user = await tx.users.findById(t.userId);
      if (!user || user.status !== "pending_activation") return { ok: false, reason: "invalid_link" };
      await tx.oneTimeTokens.markUsed(t.id, now);
      await tx.users.update(user.id, { passwordHash, status: "active" });
      const actor = { kind: "user" as const, userId: user.id, activeRole: null, ctx };
      await tx.audit.append(auditEntry(actor, deps.ids.next(), now, { action: "identity.user.activated", targetType: "user", targetId: user.id }));
      const opened = await openSession(deps, tx, { ...user, passwordHash, status: "active" }, now, ctx, "activation");
      return { ok: true, ...opened };
    });
  };
}
