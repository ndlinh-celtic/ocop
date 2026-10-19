import type { Role, ScopeType } from "./roles";

export type UserStatus = "pending_activation" | "active";

/** Người dùng: one person with a login. */
export interface User {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string | null;
  status: UserStatus;
  createdAt: Date;
}

/** Phân vai: a Vai trò on a Phạm vi for a Người dùng, valid over [validFrom, validTo). */
export interface RoleAssignment {
  id: string;
  userId: string;
  role: Role;
  scopeType: ScopeType;
  scopeId: string | null;
  validFrom: Date;
  validTo: Date | null;
  grantedBy: string | null;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  activeAssignmentId: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  /** Last time the Người dùng proved who they are (sign-in or Xác thực lại). */
  authenticatedAt: Date;
  revokedAt: Date | null;
}

export const isAssignmentActive = (a: RoleAssignment, at: Date) =>
  a.validFrom <= at && (a.validTo === null || at < a.validTo);
