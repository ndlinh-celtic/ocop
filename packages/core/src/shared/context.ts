import type { Role, ScopeType } from "../identity/roles";

/** Where a request came from; every audit row carries it. */
export interface RequestContext {
  requestId: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

/** A signed-in Người dùng acting through their Vai trò đang dùng. */
export interface UserActor {
  kind: "user";
  userId: string;
  fullName: string;
  email: string;
  sessionId: string;
  activeRole: Role | null;
  activeAssignmentId: string | null;
  activeScope: { type: ScopeType; id: string | null } | null;
  ctx: RequestContext;
}

export interface AnonymousActor {
  kind: "anonymous";
  ctx: RequestContext;
}

/** Background work that acts on behalf of the system, never of a person. */
export interface SystemActor {
  kind: "system";
  name: string;
  ctx: RequestContext;
}

export type Actor = UserActor | AnonymousActor | SystemActor;
