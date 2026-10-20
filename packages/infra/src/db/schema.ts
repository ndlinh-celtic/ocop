import { bigint, integer, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Mirrors the reviewed SQL in migrations/; the SQL is the source of truth.
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const identity = pgSchema("identity");
export const platform = pgSchema("platform");
export const org = pgSchema("org");

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

export const outbox = platform.table("outbox", {
  id: uuid("id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  occurredAt: ts("occurred_at").notNull(),
  dispatchedAt: ts("dispatched_at"),
});

export const processedEvent = platform.table("processed_event", {
  eventId: uuid("event_id").notNull(),
  consumer: text("consumer").notNull(),
  processedAt: ts("processed_at").notNull(),
});

export const emailDelivery = platform.table("email_delivery", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id"),
  consumer: text("consumer").notNull(),
  recipient: text("recipient").notNull(),
  template: text("template").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  attemptedAt: ts("attempted_at").notNull(),
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

export const ward = org.table("ward", {
  id: uuid("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
});

export const notification = platform.table("notification", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  createdAt: ts("created_at").notNull(),
  readAt: ts("read_at"),
});

export const file = platform.table("file", {
  id: uuid("id").primaryKey(),
  ownerUserId: uuid("owner_user_id").notNull(),
  purpose: text("purpose").$type<"test_upload">().notNull(),
  storageKey: text("storage_key").notNull(),
  fileName: text("file_name").notNull(),
  declaredType: text("declared_type").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  multipartUploadId: text("multipart_upload_id"),
  status: text("status").$type<"awaiting_upload" | "scanning" | "clean" | "blocked">().notNull(),
  detectedType: text("detected_type"),
  sha256: text("sha256"),
  blockReason: text("block_reason"),
  createdAt: ts("created_at").notNull(),
  uploadedAt: ts("uploaded_at"),
  scannedAt: ts("scanned_at"),
});
