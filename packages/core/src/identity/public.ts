// The public interface of the identity module: what apps/web, apps/worker and packages/infra may use, re-exported by src/index.ts.
export type { AuthMethod, RoleAssignment, Session, SessionStage, User, UserStatus } from "./model";
export type { RoleAssignmentRepo, SessionRepo, UserRepo } from "./repos";
export { ROLES, ROLE_LABEL, SCOPE_OF_ROLE, SCOPE_TYPES, TOTP_OPTIONAL_ROLES, type Role, type ScopeType } from "./roles";
export { MIN_PASSWORD_LENGTH } from "./password";
export type { OneTimePurpose, OneTimeToken, OneTimeTokenRepo } from "./tokens";
export { can, authorize, type Action } from "./policy";
export type { GrantRoleInput } from "./assignments";
export { REAUTH_WINDOW_MS, requireRecentAuth, type ReauthProof, type ReauthResult } from "./reauth";
export { dataScopeOf, type DataScope } from "./scope";
export { onBehalfOf } from "./on-behalf";
