import { searchAudit } from "./audit/search";
import { grantRole, revokeRole } from "./identity/assignments";
import { bootstrapFirstAdmin } from "./identity/bootstrap";
import { listNotifications, markAllRead, markRead, unreadCount } from "./notifications/inbox";
import { listWards } from "./org/catalogue";
import { authenticate, signIn, signOut } from "./identity/session";
import { activateAccount, createStaffUser, describeActivation, listUsers, resendActivation } from "./identity/staff";
import { confirmTotpEnrollment, pendingSignIn, startTotpEnrollment, verifySignInTotp } from "./identity/totp";
import { handleEvent } from "./platform/consumers";
import { listDeliveries } from "./platform/deliveries";
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
      createStaffUser: createStaffUser(deps),
      resendActivation: resendActivation(deps),
      listUsers: listUsers(deps),
      describeActivation: describeActivation(deps),
      activateAccount: activateAccount(deps),
      grantRole: grantRole(deps),
      revokeRole: revokeRole(deps),
    },
    org: {
      listWards: listWards(deps),
    },
    notifications: {
      list: listNotifications(deps),
      unreadCount: unreadCount(deps),
      markRead: markRead(deps),
      markAllRead: markAllRead(deps),
      listDeliveries: listDeliveries(deps),
    },
    platform: {
      handleEvent: handleEvent(deps),
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
