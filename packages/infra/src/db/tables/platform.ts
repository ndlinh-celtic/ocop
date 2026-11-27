import type { DocumentTemplate, StoredFilePurpose } from "@ocop/core";
import { bigint, boolean, integer, jsonb, pgSchema, text, uuid } from "drizzle-orm/pg-core";
import { ts } from "./columns";

export const platform = pgSchema("platform");

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
  purpose: text("purpose").$type<StoredFilePurpose>().notNull(),
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

export const rateLimitHit = platform.table("rate_limit_hit", {
  bucket: text("bucket").notNull(),
  subjectHash: text("subject_hash").notNull(),
  occurredAt: ts("occurred_at").notNull(),
});

// Cấu hình chung and the ledger of nhắc hạn (0026_due_reminders.sql).
export const systemSetting = platform.table("system_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull(),
  updatedBy: uuid("updated_by").notNull(),
});

/** Mẫu văn bản có phiên bản (0046_document_template_version.sql, #82): insert only, but for `active`. */
export const documentTemplateVersion = platform.table("document_template_version", {
  id: uuid("id").primaryKey(),
  kind: text("kind").$type<DocumentTemplate>().notNull(),
  n: integer("n").notNull(),
  fileId: uuid("file_id").notNull(),
  uploadedBy: uuid("uploaded_by").notNull(),
  uploadedAt: ts("uploaded_at").notNull(),
  active: boolean("active").notNull(),
});
