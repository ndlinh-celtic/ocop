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
  /** Sealed with SecretBox; null until enrolment is confirmed. */
  totpSecretEnc: string | null;
  totpEnabledAt: Date | null;
  /** Last accepted TOTP time step; codes at or before it are replays. */
  totpLastStep: number | null;
  /** Sealed secret shown during enrolment, not yet confirmed. */
  totpPendingSecretEnc: string | null;
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

/**
 * A session is usable only at `full`. The earlier stages exist between the password step and
 * the TOTP step, or until a Người dùng who must use TOTP has enrolled.
 */
export type SessionStage = "totp_pending" | "totp_enrollment" | "full";

export interface Session {
  id: string;
  stage: SessionStage;
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
