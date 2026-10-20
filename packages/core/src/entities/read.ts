import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { entityNotFound, maskPersonalId, type Entity, type EntityKind } from "./model";
import { representativeOf } from "./representative";

/**
 * A Chủ thể as its reader may see it. The số định danh cá nhân is always masked here, even for the Chủ thể
 * itself (story 13); the full number is `revealPersonalId`, an audited personal data access.
 */
export interface EntityView {
  id: string;
  kind: EntityKind;
  name: string;
  /** Mã số thuế, or the masked số định danh cá nhân. */
  identifier: string;
  address: string;
  representativeName: string;
  phone: string;
  ward: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}

async function view(tx: Tx, e: Entity): Promise<EntityView> {
  const identifier = e.taxCode ?? maskPersonalId(e.personalIdLast4!);
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

/** The Chủ thể within the reader's Phạm vi; any other is not found, whether or not it exists (story 80). */
export function getEntity(deps: CoreDeps) {
  return async (actor: Actor, input: { entityId: string }): Promise<EntityDetailView> => {
    authorize(actor, "entity.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.entityId, entityNotFound);
      const entity = await tx.entities.findById(scope, input.entityId);
      if (!entity) throw entityNotFound();
      const representative = await representativeOf(tx, entity.id, deps.clock.now());
      return {
        ...(await view(tx, entity)),
        representativeEmail: representative?.email ?? null,
        representativeActivated: representative?.status === "active",
      };
    });
  };
}

/** Every Chủ thể within the reader's Phạm vi; for a Chủ thể, only itself. */
export function listEntities(deps: CoreDeps) {
  return async (actor: Actor): Promise<EntityView[]> => {
    authorize(actor, "entity.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => Promise.all((await tx.entities.list(scope)).map((e) => view(tx, e))));
  };
}
