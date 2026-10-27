import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { dataScopeOf, type DataScope } from "../identity/scope";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { entityNotFound, maskPersonalId, type Entity, type EntityKind } from "./model";
import { representativeOf } from "./representative";

/**
 * A Chủ thể as its reader may see it. The số định danh cá nhân is in full for the Chủ thể itself and
 * masked for everyone else (story 13); their full number is `revealPersonalId`, an audited personal
 * data access.
 */
export interface EntityView {
  id: string;
  kind: EntityKind;
  name: string;
  /** Mã số thuế, or the số định danh cá nhân: in full for the Chủ thể itself, masked for anyone else. */
  identifier: string;
  address: string;
  representativeName: string;
  phone: string;
  ward: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}

/** Whether the reader is the Chủ thể itself, signed in as it (not a Cán bộ xã doing Nhập hộ). */
export const isOwnEntity = (scope: DataScope, entityId: string) => scope.kind === "entity" && scope.entityId === entityId;

async function view(deps: CoreDeps, tx: Tx, scope: DataScope, e: Entity): Promise<EntityView> {
  const identifier =
    e.taxCode ?? (isOwnEntity(scope, e.id) && e.personalIdSealed ? deps.secretBox.open(e.personalIdSealed) : maskPersonalId(e.personalIdLast4!));
  const ward = await tx.wards.findById(e.wardId);
  return {
    id: e.id,
    kind: e.kind,
    name: e.name,
    identifier,
    address: e.address,
    representativeName: e.representativeName,
    phone: e.phone,
    ward: { id: e.wardId, name: ward?.name ?? "" },
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

/** One Chủ thể with the email its Người dùng đại diện signs in and recovers the account with. */
export interface EntityDetailView extends EntityView {
  representativeEmail: string | null;
  /** False while the Người dùng đại diện has not yet set a password from the activation email. */
  representativeActivated: boolean;
}

/**
 * The Chủ thể within the reader's Phạm vi; any other is not found, whether or not it exists (story 80).
 * The contact details of its người đại diện are personal data: a read by anyone but the Chủ thể itself is
 * audited (NĐ 13/2023).
 */
export function getEntity(deps: CoreDeps) {
  return async (actor: Actor, input: { entityId: string }): Promise<EntityDetailView> => {
    authorize(actor, "entity.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.entityId, entityNotFound);
      const entity = await tx.entities.findById(scope, input.entityId);
      if (!entity) throw entityNotFound();
      const now = deps.clock.now();
      const representative = await representativeOf(tx, entity.id, now);
      if (!isOwnEntity(scope, entity.id)) {
        await tx.audit.append(
          auditEntry(actor, deps.ids.next(), now, {
            action: "personal_data.viewed",
            targetType: "entity",
            targetId: entity.id,
            metadata: { view: "entity_detail" },
          }),
        );
      }
      return {
        ...(await view(deps, tx, scope, entity)),
        representativeEmail: representative?.email ?? null,
        representativeActivated: representative?.status === "active",
      };
    });
  };
}

/**
 * Every Chủ thể within the reader's Phạm vi; for a Chủ thể, only itself. A list read by anyone but the
 * Chủ thể itself is audited as a personal data access, like `getEntity`.
 */
export function listEntities(deps: CoreDeps) {
  return async (actor: Actor): Promise<EntityView[]> => {
    authorize(actor, "entity.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      const entities = await tx.entities.list(scope);
      if (scope.kind !== "entity") {
        await tx.audit.append(
          auditEntry(actor, deps.ids.next(), deps.clock.now(), {
            action: "personal_data.viewed",
            targetType: "entity",
            metadata: { view: "entity_list", count: entities.length },
          }),
        );
      }
      return Promise.all(entities.map((e) => view(deps, tx, scope, e)));
    });
  };
}
