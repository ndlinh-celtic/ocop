import { authorize } from "../identity/policy";
import { dataScopeOf, type DataScope } from "../identity/scope";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { entityNotFound, maskPersonalId, type Entity, type EntityKind } from "./model";

/** A Chủ thể as its reader may see it: the số định danh cá nhân in full only for the Chủ thể itself. */
export interface EntityView {
  id: string;
  kind: EntityKind;
  name: string;
  /** Mã số thuế, or the số định danh cá nhân (masked unless the reader is the Chủ thể). */
  identifier: string;
  address: string;
  representativeName: string;
  phone: string;
  ward: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}

async function view(deps: CoreDeps, tx: Tx, scope: DataScope, e: Entity): Promise<EntityView> {
  const own = scope.kind === "entity" && scope.entityId === e.id;
  const identifier = e.taxCode ?? (own ? deps.secretBox.open(e.personalIdSealed!) : maskPersonalId(e.personalIdLast4!));
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

/** The Chủ thể within the reader's Phạm vi; any other is not found, whether or not it exists (story 80). */
export function getEntity(deps: CoreDeps) {
  return async (actor: Actor, input: { entityId: string }): Promise<EntityView> => {
    authorize(actor, "entity.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.entityId, entityNotFound);
      const entity = await tx.entities.findById(scope, input.entityId);
      if (!entity) throw entityNotFound();
      return view(deps, tx, scope, entity);
    });
  };
}

/** Every Chủ thể within the reader's Phạm vi; for a Chủ thể, only itself. */
export function listEntities(deps: CoreDeps) {
  return async (actor: Actor): Promise<EntityView[]> => {
    authorize(actor, "entity.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => Promise.all((await tx.entities.list(scope)).map((e) => view(deps, tx, scope, e))));
  };
}
