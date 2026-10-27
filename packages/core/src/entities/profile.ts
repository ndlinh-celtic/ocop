import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { emit } from "../platform/emit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import { entityNotFound, parseDetails, type Entity, type EntityDetails } from "./model";
import { isOwnEntity } from "./read";
import { assertWard } from "./register";

export interface UpdateEntityInput extends EntityDetails {
  entityId: string;
  /** Xã/phường đăng ký. Hồ sơ already submitted keep the xã they were submitted to (story 10). */
  wardId: string;
}

const detailsOf = (e: Entity) => ({ name: e.name, address: e.address, representativeName: e.representativeName, phone: e.phone });

/**
 * L01 CT-02 (stories 9, 10): the Chủ thể edits its organisation details and may move to another xã/phường
 * đăng ký. Its Loại tổ chức and identifier stay as registered. A change of xã is audited and announced on
 * its own; hồ sơ carry their own xã from submission, so none of them moves.
 */
export function updateEntity(deps: CoreDeps) {
  return async (actor: Actor, input: UpdateEntityInput): Promise<void> => {
    authorize(actor, "entity.update");
    const scope = dataScopeOf(actor);
    const details = parseDetails(input);
    await deps.uow.run(async (tx) => {
      assertIdShape(input.entityId, entityNotFound);
      const before = await tx.entities.lock(scope, input.entityId);
      if (!before) throw entityNotFound();
      await assertWard(tx, input.wardId);

      const now = deps.clock.now();
      const after: Entity = { ...before, ...details, wardId: input.wardId, updatedAt: now };
      await tx.entities.update(after);

      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "entity.updated",
          targetType: "entity",
          targetId: after.id,
          before: detailsOf(before),
          after: detailsOf(after),
        }),
      );
      await emit(deps, tx, { type: "entity.updated", payload: { entityId: after.id } });
      if (after.wardId !== before.wardId) {
        await tx.audit.append(
          auditEntry(actor, deps.ids.next(), now, {
            action: "entity.ward_changed",
            targetType: "entity",
            targetId: after.id,
            before: { wardId: before.wardId },
            after: { wardId: after.wardId },
          }),
        );
        await emit(deps, tx, { type: "entity.ward_changed", payload: { entityId: after.id, fromWardId: before.wardId, toWardId: after.wardId } });
      }
    });
  };
}

/**
 * Story 13: the full số định danh cá nhân of a hộ sản xuất. Every other read by anyone but the hộ itself
 * shows only the last four digits; this one is a separate use case and is audited as a personal data
 * access (NĐ 13/2023), except when the hộ reads its own number.
 */
export function revealPersonalId(deps: CoreDeps) {
  return async (actor: Actor, input: { entityId: string }): Promise<{ personalId: string }> => {
    authorize(actor, "entity.personal_id.reveal");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.entityId, entityNotFound);
      const entity = await tx.entities.findById(scope, input.entityId);
      if (!entity) throw entityNotFound();
      if (!entity.personalIdSealed) throw new DomainError("no_personal_id", "Chủ thể này không đăng ký bằng số định danh cá nhân");
      if (!isOwnEntity(scope, entity.id)) {
        await tx.audit.append(
          auditEntry(actor, deps.ids.next(), deps.clock.now(), {
            action: "personal_data.viewed",
            targetType: "entity",
            targetId: entity.id,
            metadata: { view: "entity_personal_id" },
          }),
        );
      }
      return { personalId: deps.secretBox.open(entity.personalIdSealed) };
    });
  };
}
