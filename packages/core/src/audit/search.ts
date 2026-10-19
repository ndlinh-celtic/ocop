import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { forbidden } from "../shared/errors";
import type { AuditFilter } from "./audit";

/** Quản trị looks up audit rows by user, object and time range (L21 step 3). */
export function searchAudit(deps: CoreDeps) {
  return async (actor: Actor, filter: AuditFilter) => {
    if (actor.kind !== "user" || actor.activeRole !== "admin") throw forbidden();
    return deps.uow.run((tx) => tx.audit.search({ ...filter, limit: Math.min(filter.limit ?? 200, 1000) }));
  };
}
