import { searchAudit } from "./audit/search";
import { bootstrapFirstAdmin } from "./identity/bootstrap";
import { authenticate, signIn, signOut } from "./identity/session";
import type { CoreDeps } from "./shared/deps";

/** The use cases of the core, bound to their dependencies. UI and worker only call these. */
export function createCore(deps: CoreDeps) {
  return {
    identity: {
      bootstrapFirstAdmin: bootstrapFirstAdmin(deps),
      signIn: signIn(deps),
      authenticate: authenticate(deps),
      signOut: signOut(deps),
    },
    audit: {
      search: searchAudit(deps),
    },
  };
}

export type Core = ReturnType<typeof createCore>;
