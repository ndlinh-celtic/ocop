import { auditEntry } from "../audit/audit";
import { emit } from "../platform/emit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { isUuid } from "../shared/ids";
import type { Tx } from "../shared/uow";
import type { RoleAssignment } from "./model";
import { authorize } from "./policy";
import { ROLE_LABEL, SCOPE_OF_ROLE, type Role, type ScopeType } from "./roles";
import { mustUseTotp } from "./session";

export interface GrantRoleInput {
  userId: string;
  role: Role;
  /** Null for Phạm vi tỉnh and hệ thống; the id of the ward, entity or council otherwise. */
  scopeId: string | null;
  validFrom?: Date;
  validTo?: Date | null;
}

const SCOPE_WITHOUT_ID: readonly ScopeType[] = ["province", "system"];

/**
 * Checks that the Phạm vi exists. A Phạm vi Hội đồng is any recorded Hội đồng (L09 HD-01); Chủ thể are
 * granted their Vai trò by registration (entities), never by Quản trị.
 */
async function assertScope(tx: Tx, scopeType: ScopeType, scopeId: string | null) {
  if (SCOPE_WITHOUT_ID.includes(scopeType)) {
    if (scopeId !== null) throw new DomainError("scope_mismatch", "Vai trò này không gắn với một đơn vị cụ thể");
    return;
  }
  if (scopeId === null) throw new DomainError("scope_required", "Chọn phạm vi cho vai trò này");
  if (scopeType === "ward") {
    if (!(await tx.wards.findById(scopeId))) throw new DomainError("scope_not_found", "Không tìm thấy xã/phường");
    return;
  }
  if (scopeType === "council") {
    if (!isUuid(scopeId) || !(await tx.councils.findById(scopeId))) throw new DomainError("scope_not_found", "Không tìm thấy hội đồng");
    return;
  }
  throw new DomainError("scope_not_available", "Vai trò Chủ thể được cấp khi đăng ký, không gán ở đây");
}

export async function scopeLabel(tx: Tx, a: Pick<RoleAssignment, "scopeType" | "scopeId">): Promise<string> {
  if (a.scopeType === "system") return "Toàn hệ thống";
  if (a.scopeType === "province") return "Toàn tỉnh";
  if (a.scopeType === "ward" && a.scopeId) return (await tx.wards.findById(a.scopeId))?.name ?? "Xã/phường đã xóa";
  if (a.scopeType === "entity" && a.scopeId) return (await tx.entities.findById({ kind: "entity", entityId: a.scopeId }, a.scopeId))?.name ?? "Chủ thể";
  if (a.scopeType === "council" && a.scopeId) return (await tx.councils.findById(a.scopeId))?.name ?? "Hội đồng";
  return a.scopeId ?? "";
}

const describe = (a: RoleAssignment) => ({
  role: a.role,
  scopeType: a.scopeType,
  scopeId: a.scopeId,
  validFrom: a.validFrom.toISOString(),
  validTo: a.validTo?.toISOString() ?? null,
});

export function grantRole(deps: CoreDeps) {
  return async (actor: Actor, input: GrantRoleInput) => {
    authorize(actor, "role.grant");
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const user = await tx.users.findById(input.userId);
      if (!user) throw new DomainError("user_not_found", "Không tìm thấy người dùng");
      const scopeType = SCOPE_OF_ROLE[input.role];
      if (!scopeType) throw new DomainError("role_unknown", "Vai trò không hợp lệ");
      if (input.scopeId !== null && SCOPE_WITHOUT_ID.includes(scopeType)) {
        throw new DomainError("scope_mismatch", "Vai trò này không gắn với một đơn vị cụ thể");
      }
      await assertScope(tx, scopeType, input.scopeId);
      const validFrom = input.validFrom ?? now;
      const validTo = input.validTo ?? null;
      if (validTo && validTo <= validFrom) throw new DomainError("valid_range", "Ngày kết thúc phải sau ngày bắt đầu");

      const existing = await tx.roleAssignments.listForUser(user.id);
      const overlapping = existing.some(
        (a) =>
          a.role === input.role &&
          a.scopeId === input.scopeId &&
          (a.validTo === null || a.validTo > validFrom) &&
          (validTo === null || a.validFrom < validTo),
      );
      if (overlapping) throw new DomainError("already_assigned", "Người dùng đã có phân vai này");

      const assignment: RoleAssignment = {
        id: deps.ids.next(),
        userId: user.id,
        role: input.role,
        scopeType,
        scopeId: input.scopeId,
        validFrom,
        validTo,
        grantedBy: actor.userId,
        createdAt: now,
      };
      await tx.roleAssignments.insert(assignment);

      // A Vai trò that needs TOTP must not ride on a session that never passed TOTP.
      if (!user.totpEnabledAt && mustUseTotp([...existing, assignment], validFrom, deps.settings.totpRequired)) {
        await tx.sessions.revokeAllForUser(user.id, now);
      }
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "identity.role.granted",
          targetType: "role_assignment",
          targetId: assignment.id,
          after: describe(assignment),
          metadata: { userId: user.id },
        }),
      );
      await emit(deps, tx, { type: "identity.role.granted", payload: { assignmentId: assignment.id } });
      return { assignmentId: assignment.id };
    });
  };
}

export function revokeRole(deps: CoreDeps) {
  return async (actor: Actor, input: { assignmentId: string }) => {
    authorize(actor, "role.revoke");
    const { assignmentId } = input;
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const a = await tx.roleAssignments.findById(assignmentId);
      if (!a) throw new DomainError("not_found", "Không tìm thấy phân vai");
      if (a.validTo !== null && a.validTo <= now) throw new DomainError("already_ended", "Phân vai đã hết hiệu lực");
      const validTo = a.validFrom > now ? a.validFrom : now;
      await tx.roleAssignments.end(a.id, validTo);
      await tx.sessions.revokeAllForUser(a.userId, now);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "identity.role.revoked",
          targetType: "role_assignment",
          targetId: a.id,
          before: describe(a),
          after: describe({ ...a, validTo }),
          metadata: { userId: a.userId },
        }),
      );
    });
  };
}

/** For the role-granted email and notification. */
export async function describeGrant(tx: Tx, assignmentId: string) {
  const a = await tx.roleAssignments.findById(assignmentId);
  if (!a) return null;
  const user = await tx.users.findById(a.userId);
  if (!user) return null;
  return { assignment: a, user, roleLabel: ROLE_LABEL[a.role], scopeLabel: await scopeLabel(tx, a) };
}

