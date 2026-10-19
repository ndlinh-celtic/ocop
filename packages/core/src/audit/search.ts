import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { authorize } from "../identity/policy";
import type { AuditFilter } from "./audit";

/** Quản trị looks up audit rows by user, object and time range (L21 step 3). */
export function searchAudit(deps: CoreDeps) {
  return async (actor: Actor, filter: AuditFilter) => {
    authorize(actor, "audit.search");
    return deps.uow.run((tx) => tx.audit.search({ ...filter, limit: Math.min(filter.limit ?? 200, 1000) }));
  };
}
