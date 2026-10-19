import { searchAudit } from "./audit/search";
import { bootstrapFirstAdmin } from "./identity/bootstrap";
import { authenticate, signIn, signOut } from "./identity/session";
import { confirmTotpEnrollment, pendingSignIn, startTotpEnrollment, verifySignInTotp } from "./identity/totp";
import type { CoreDeps } from "./shared/deps";
import { recordStartup } from "./system/startup";

/** The use cases of the core, bound to their dependencies. UI and worker only call these. */
export function createCore(deps: CoreDeps) {
  return {
    identity: {
      bootstrapFirstAdmin: bootstrapFirstAdmin(deps),
      signIn: signIn(deps),
      verifySignInTotp: verifySignInTotp(deps),
      pendingSignIn: pendingSignIn(deps),
      startTotpEnrollment: startTotpEnrollment(deps),
      confirmTotpEnrollment: confirmTotpEnrollment(deps),
      authenticate: authenticate(deps),
      signOut: signOut(deps),
    },
    audit: {
      search: searchAudit(deps),
    },
    system: {
      recordStartup: recordStartup(deps),
    },
  };
}

export type Core = ReturnType<typeof createCore>;
