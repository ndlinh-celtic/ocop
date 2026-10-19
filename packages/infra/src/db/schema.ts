import { bigint, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Mirrors the reviewed SQL in migrations/; the SQL is the source of truth.
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const identity = pgSchema("identity");
export const platform = pgSchema("platform");

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
  revokedAt: ts("revoked_at"),
});

export const auditLog = platform.table("audit_log", {
  id: uuid("id").notNull(),
  occurredAt: ts("occurred_at").notNull(),
  actorUserId: uuid("actor_user_id"),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
  requestId: text("request_id"),
  ip: text("ip"),
});
