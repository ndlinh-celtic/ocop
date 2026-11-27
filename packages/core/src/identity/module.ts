import { defineModule } from "../shared/module";
import { issueActivationLink } from "./activation-email";
import { hasTotp, myAssignments, switchActiveRole } from "./active-role";
import { grantRole, revokeRole } from "./assignments";
import { bootstrapFirstAdmin } from "./bootstrap";
import { changePassword, emailAccountLocked, emailPasswordReset, requestPasswordReset, resetPassword } from "./passwords";
import { reauthenticate, sensitiveSample } from "./reauth";
import { emailRoleGranted, notifyRoleGranted } from "./role-granted";
import { authenticate, signIn, signOut } from "./session";
import { activateAccount, createStaffUser, describeActivation, getUser, listUsers, resendActivation } from "./staff";
import { confirmTotpEnrollment, pendingSignIn, startTotpEnrollment, verifySignInTotp } from "./totp";

export const identityModule = defineModule({
  useCases: {
    bootstrapFirstAdmin,
    signIn,
    verifySignInTotp,
    pendingSignIn,
    startTotpEnrollment,
    confirmTotpEnrollment,
    authenticate,
    signOut,
    createStaffUser,
    resendActivation,
    listUsers,
    getUser,
    describeActivation,
    activateAccount,
    grantRole,
    revokeRole,
    myAssignments,
    switchActiveRole,
    hasTotp,
    requestPasswordReset,
    resetPassword,
    changePassword,
    reauthenticate,
    sensitiveSample,
  },
  consumers: {
    "identity.activation-email": { events: ["identity.user.created", "identity.activation.requested"], handle: issueActivationLink },
    "identity.role-granted-email": { events: ["identity.role.granted"], handle: emailRoleGranted },
    "notifications.role-granted": { events: ["identity.role.granted"], handle: notifyRoleGranted },
    "identity.lockout-email": { events: ["identity.user.locked"], handle: emailAccountLocked },
    "identity.password-reset-email": { events: ["identity.password_reset.requested"], handle: emailPasswordReset },
  },
});
