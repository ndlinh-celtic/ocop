import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { emit } from "../platform/emit";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError, forbidden } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import { entityNotFound } from "./model";
import { representativeOf } from "./representative";
import { assertWard, insertEntityWithRepresentative, parseEmail, parseNewEntity, type NewEntityInput } from "./register";

/** The xã/phường of the Cán bộ xã's Vai trò đang dùng. */
function officerWard(actor: UserActor): string {
  const scope = dataScopeOf(actor);
  if (scope.kind !== "ward") throw forbidden();
  return scope.wardId;
}

/**
 * L01 (story 11): a Cán bộ xã opens a Chủ thể for a hộ sản xuất (or any Loại tổ chức) that cannot register
 * itself. The Chủ thể is registered in the officer's own xã, never another; its Người dùng đại diện still
 * needs an email, receives the activation link there and sets their own password. The officer is audited
 * as the one who created it.
 */
export function createEntity(deps: CoreDeps) {
  return async (actor: Actor, input: NewEntityInput): Promise<{ entityId: string }> => {
    authorize(actor, "entity.create");
    const wardId = officerWard(actor);
    const form = parseNewEntity(input);
    return deps.uow.run(async (tx) => {
      await assertWard(tx, wardId);
      if (await tx.users.findByEmail(form.email)) throw emailTaken();
      const now = deps.clock.now();
      const created = await insertEntityWithRepresentative(deps, tx, form, wardId, now);
      if (!created) throw new DomainError("identifier_taken", "Đã có Chủ thể với mã số thuế hoặc số định danh này");
      const { entity, userId, assignment } = created;

      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "entity.created",
          targetType: "entity",
          targetId: entity.id,
          after: { kind: entity.kind, name: entity.name, wardId: entity.wardId },
          metadata: { userId, assignmentId: assignment.id },
        }),
      );
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "identity.user.created",
          targetType: "user",
          targetId: userId,
          after: { email: form.email, fullName: form.representativeName },
          metadata: { entityId: entity.id },
        }),
      );
      await emit(deps, tx, { type: "entity.created", payload: { entityId: entity.id, userId } });
      await emit(deps, tx, { type: "identity.user.created", payload: { userId } });
      return { entityId: entity.id };
    });
  };
}

const emailTaken = () => new DomainError("email_taken", "Email này đã được dùng cho một tài khoản khác");

/**
 * L01 (story 12): a Cán bộ xã gives the Người dùng đại diện of a Chủ thể đăng ký ở xã mình a new email, so a
 * Chủ thể that lost its mailbox can sign in and reset its password again. Links already sent to the old
 * address stop working and its sessions end; one still pending activation gets a fresh link at the new
 * address.
 */
export function changeRepresentativeEmail(deps: CoreDeps) {
  return async (actor: Actor, input: { entityId: string; email: string }): Promise<void> => {
    authorize(actor, "entity.representative_email.change");
    const wardId = officerWard(actor);
    const email = parseEmail(input.email);
    await deps.uow.run(async (tx) => {
      assertIdShape(input.entityId, entityNotFound);
      const entity = await tx.entities.lock(dataScopeOf(actor), input.entityId);
      // Only for a Chủ thể đăng ký ở xã mình, even once the Phạm vi also covers Chủ thể with a hồ sơ here.
      if (!entity || entity.wardId !== wardId) throw entityNotFound();
      const now = deps.clock.now();
      const representative = await representativeOf(tx, entity.id, now);
      if (!representative) throw new DomainError("no_representative", "Chủ thể này không còn Người dùng đại diện");
      if (representative.email.toLowerCase() === email.toLowerCase()) throw new DomainError("email_unchanged", "Email mới trùng với email hiện tại");
      if (await tx.users.findByEmail(email)) throw emailTaken();

      await tx.users.update(representative.id, { email });
      await tx.oneTimeTokens.invalidateOpen(representative.id, "activation", now);
      await tx.oneTimeTokens.invalidateOpen(representative.id, "password_reset", now);
      await tx.sessions.revokeAllForUser(representative.id, now);

      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "entity.representative_email_changed",
          targetType: "entity",
          targetId: entity.id,
          before: { email: representative.email },
          after: { email },
          metadata: { userId: representative.id },
        }),
      );
      await emit(deps, tx, { type: "entity.representative_email_changed", payload: { entityId: entity.id, userId: representative.id } });
      if (representative.status === "pending_activation") {
        await emit(deps, tx, { type: "identity.activation.requested", payload: { userId: representative.id } });
      }
    });
  };
}
