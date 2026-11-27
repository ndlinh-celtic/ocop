import { bigint, integer, pgSchema, text, uuid } from "drizzle-orm/pg-core";
import { ts } from "./columns";

export const identity = pgSchema("identity");

export const userAccount = identity.table("user_account", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  passwordHash: text("password_hash"),
  status: text("status").$type<"pending_activation" | "active">().notNull(),
  createdAt: ts("created_at").notNull(),
  totpSecretEnc: text("totp_secret_enc"),
  totpEnabledAt: ts("totp_enabled_at"),
  totpLastStep: bigint("totp_last_step", { mode: "number" }),
  totpPendingSecretEnc: text("totp_pending_secret_enc"),
  failedCount: integer("failed_count").notNull(),
  failedWindowStart: ts("failed_window_start"),
  lockedUntil: ts("locked_until"),
});

export const roleAssignment = identity.table("role_assignment", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  role: text("role").notNull(),
  scopeType: text("scope_type").notNull(),
  scopeId: uuid("scope_id"),
  validFrom: ts("valid_from").notNull(),
  validTo: ts("valid_to"),
  grantedBy: uuid("granted_by"),
  createdAt: ts("created_at").notNull(),
});

export const session = identity.table("session", {
  id: uuid("id").primaryKey(),
  stage: text("stage").$type<"totp_pending" | "totp_enrollment" | "full">().notNull(),
  userId: uuid("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  activeAssignmentId: uuid("active_assignment_id"),
  createdAt: ts("created_at").notNull(),
  lastSeenAt: ts("last_seen_at").notNull(),
  authenticatedAt: ts("authenticated_at").notNull(),
  authMethod: text("auth_method").$type<"password" | "password+totp" | "totp">().notNull(),
  revokedAt: ts("revoked_at"),
});

export const oneTimeToken = identity.table("one_time_token", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  purpose: text("purpose").$type<"activation" | "password_reset">().notNull(),
  tokenHash: text("token_hash").notNull(),
  createdAt: ts("created_at").notNull(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  invalidatedAt: ts("invalidated_at"),
});
