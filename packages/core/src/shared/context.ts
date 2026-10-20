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
  /**
   * Nhập hộ (L01): the Chủ thể a Cán bộ xã acts for, by id. Set only through `onBehalfOf()`; the Phạm vi
   * then narrows to that Chủ thể while it is đăng ký ở xã of the officer, and only the `*_on_behalf`
   * actions are allowed, audited as the officer with `onBehalfOf`.
   */
  onBehalfOf?: string;
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

export const anonymousActor = (ctx: RequestContext): AnonymousActor => ({ kind: "anonymous", ctx });

/** A job or command; its request id says which, for the audit trail. */
export const systemActor = (name: string, ctx: RequestContext = { requestId: `job:${name}` }): SystemActor => ({ kind: "system", name, ctx });
