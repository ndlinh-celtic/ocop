import { requireAdmin } from "../identity/guards";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";

/** L23 step 4: Quản trị sees whether emails went out or failed. */
export function listDeliveries(deps: CoreDeps) {
  return async (actor: Actor, filter: { to?: string; limit?: number }) => {
    requireAdmin(actor);
    return deps.uow.run((tx) => tx.emailDeliveries.list({ ...filter, limit: Math.min(filter.limit ?? 100, 500) }));
  };
}
