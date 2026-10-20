import { auditEntry } from "../audit/audit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { scopeLabel } from "./assignments";
import { isAssignmentActive } from "./model";
import { authorize } from "./policy";
import { ROLE_LABEL } from "./roles";

/** The signed-in Người dùng's active Phân vai, for the Vai trò switcher. */
export function myAssignments(deps: CoreDeps) {
  return async (actor: Actor) => {
    authorize(actor, "role.switch_own");
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const active = (await tx.roleAssignments.listForUser(actor.userId)).filter((a) => isAssignmentActive(a, now));
      return Promise.all(
        active.map(async (a) => ({
          id: a.id,
          role: a.role,
          roleLabel: ROLE_LABEL[a.role],
          scopeType: a.scopeType,
          scopeId: a.scopeId,
          scopeLabel: await scopeLabel(tx, a),
          current: a.id === actor.activeAssignmentId,
        })),
      );
    });
  };
}

/** Sets the Vai trò đang dùng of the current session; every later check uses it. */
export function switchActiveRole(deps: CoreDeps) {
  return async (actor: Actor, input: { assignmentId: string }) => {
    authorize(actor, "role.switch_own");
    const { assignmentId } = input;
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const a = await tx.roleAssignments.findById(assignmentId);
      if (!a || a.userId !== actor.userId || !isAssignmentActive(a, now)) {
        throw new DomainError("not_found", "Không tìm thấy vai trò này trong tài khoản của bạn");
      }
      await tx.sessions.update(actor.sessionId, { activeAssignmentId: a.id });
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "auth.role.switched",
          targetType: "session",
          targetId: actor.sessionId,
          metadata: { fromRole: actor.activeRole, toRole: a.role, assignmentId: a.id },
        }),
      );
    });
  };
}

/** Whether the signed-in Người dùng has TOTP, for the account page. */
export function hasTotp(deps: CoreDeps) {
  return async (actor: Actor) => {
    authorize(actor, "totp.enroll_own");
    return deps.uow.run(async (tx) => (await tx.users.findById(actor.userId))?.totpEnabledAt != null);
  };
}
