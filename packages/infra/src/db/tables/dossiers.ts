import type { ChecklistResultValue, DossierState, ReminderKind, SubmissionFileRole, SubmissionSnapshot, SupplementOutcome } from "@ocop/core";
import { boolean, integer, jsonb, pgSchema, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { ts } from "./columns";

export const dossierSchema = pgSchema("dossier");

export const dossier = dossierSchema.table("dossier", {
  id: uuid("id").primaryKey(),
  entityId: uuid("entity_id").notNull(),
  criteriaSetId: uuid("criteria_set_id").notNull(),
  criteriaVersionId: uuid("criteria_version_id").notNull(),
  state: text("state").$type<DossierState>().notNull(),
  wardId: uuid("ward_id"),
  roundId: uuid("round_id"),
  productName: text("product_name").notNull(),
  description: text("description").notNull(),
  ingredients: text("ingredients").notNull(),
  process: text("process").notNull(),
  packaging: text("packaging").notNull(),
  qualityDeclaration: text("quality_declaration").notNull(),
  receivedAt: ts("received_at"),
  receivedBy: uuid("received_by"),
  handlerUserId: uuid("handler_user_id"),
  firstForwardedAt: ts("first_forwarded_at"),
  code: text("code").notNull(),
  provinceReceivedAt: ts("province_received_at"),
  provinceReceivedBy: uuid("province_received_by"),
  firstProvinceReceivedAt: ts("first_province_received_at"),
  // 0031_grading.sql
  gradingStartedAt: ts("grading_started_at"),
  supplementDeadline: ts("supplement_deadline"),
  copiedFrom: uuid("copied_from"),
  deletedAt: ts("deleted_at"),
  version: integer("version").notNull(),
  createdAt: ts("created_at").notNull(),
  createdBy: uuid("created_by").notNull(),
  updatedAt: ts("updated_at").notNull(),
  // 0045_general_comment.sql
  resultPublishedAt: ts("result_published_at"),
  generalComment: text("general_comment"),
  generalCommentUpdatedAt: ts("general_comment_updated_at"),
  generalCommentUpdatedBy: uuid("general_comment_updated_by"),
  // 0051_five_star_proposal.sql
  awaitingSupplementaryDecision: boolean("awaiting_supplementary_decision").notNull(),
  ministryReturnFileId: uuid("ministry_return_file_id"),
});

// Mã hồ sơ, one counter row per year (0029_province_receipt.sql).
export const dossierCodeCounter = dossierSchema.table("code_counter", {
  year: integer("year").primaryKey(),
  lastNumber: integer("last_number").notNull(),
});

export const dossierEvent = dossierSchema.table("dossier_event", {
  id: uuid("id").primaryKey(),
  dossierId: uuid("dossier_id").notNull(),
  action: text("action").notNull(),
  fromState: text("from_state").$type<DossierState>(),
  toState: text("to_state").$type<DossierState>().notNull(),
  actorUserId: uuid("actor_user_id"),
  actorRole: text("actor_role"),
  occurredAt: ts("occurred_at").notNull(),
  reason: text("reason"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
});

export const evidenceFile = dossierSchema.table(
  "evidence_file",
  {
    dossierId: uuid("dossier_id").notNull(),
    fileId: uuid("file_id").notNull(),
    addedBy: uuid("added_by").notNull(),
    addedAt: ts("added_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.dossierId, t.fileId] })],
);

// Minh chứng theo tiêu chí and tự chấm thử (0020_evidence_links_and_self_assessment.sql).
export const evidenceLink = dossierSchema.table(
  "evidence_link",
  {
    dossierId: uuid("dossier_id").notNull(),
    fileId: uuid("file_id").notNull(),
    criterionId: uuid("criterion_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.dossierId, t.fileId, t.criterionId] })],
);

// L06 XA-04 Checklist sơ bộ results (0023_preliminary_checklist.sql).
export const checklistResult = dossierSchema.table(
  "checklist_result",
  {
    dossierId: uuid("dossier_id").notNull(),
    itemCode: text("item_code").notNull(),
    result: text("result").$type<ChecklistResultValue>().notNull(),
    comment: text("comment").notNull(),
    assessedAt: ts("assessed_at").notNull(),
    assessedBy: uuid("assessed_by").notNull(),
  },
  (t) => [primaryKey({ columns: [t.dossierId, t.itemCode] })],
);

// L06 XA-07 signed Báo cáo đánh giá cấp xã, append-only (0024_ward_report.sql).
export const wardReport = dossierSchema.table("ward_report", {
  id: uuid("id").primaryKey(),
  dossierId: uuid("dossier_id").notNull(),
  submissionNumber: integer("submission_number").notNull(),
  fileId: uuid("file_id").notNull(),
  uploadedBy: uuid("uploaded_by").notNull(),
  uploadedAt: ts("uploaded_at").notNull(),
});

// L04 đề nghị trả về of the xã, append-only (0027_return_requests.sql).
export const returnRequest = dossierSchema.table("return_request", {
  id: uuid("id").primaryKey(),
  dossierId: uuid("dossier_id").notNull(),
  reason: text("reason").notNull(),
  requestedBy: uuid("requested_by").notNull(),
  requestedAt: ts("requested_at").notNull(),
});

// L10 TM-03 đề nghị trả về of the Tổ tư vấn, append-only (0036_advisory_return_requests.sql).
export const advisoryReturnRequest = dossierSchema.table("advisory_return_request", {
  id: uuid("id").primaryKey(),
  dossierId: uuid("dossier_id").notNull(),
  reason: text("reason").notNull(),
  requestedBy: uuid("requested_by").notNull(),
  requestedAt: ts("requested_at").notNull(),
});

export const criterionEntry = dossierSchema.table(
  "criterion_entry",
  {
    dossierId: uuid("dossier_id").notNull(),
    criterionId: uuid("criterion_id").notNull(),
    scoreLevelId: uuid("score_level_id"),
    explanation: text("explanation").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.dossierId, t.criterionId] })],
);

// Phiên bản nộp (0021_submissions.sql): append-only, the DB refuses UPDATE and DELETE.
export const submission = dossierSchema.table("submission", {
  id: uuid("id").primaryKey(),
  dossierId: uuid("dossier_id").notNull(),
  number: integer("number").notNull(),
  roundId: uuid("round_id").notNull(),
  wardId: uuid("ward_id").notNull(),
  submittedAt: ts("submitted_at").notNull(),
  submittedBy: uuid("submitted_by").notNull(),
  snapshot: jsonb("snapshot").$type<SubmissionSnapshot>().notNull(),
});

export const submissionFile = dossierSchema.table(
  "submission_file",
  {
    submissionId: uuid("submission_id").notNull(),
    fileId: uuid("file_id").notNull(),
    role: text("role").$type<SubmissionFileRole>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.submissionId, t.fileId, t.role] })],
);

// Yêu cầu bổ sung (0023_supplement_requests.sql).
export const supplementRequest = dossierSchema.table("supplement_request", {
  id: uuid("id").primaryKey(),
  dossierId: uuid("dossier_id").notNull(),
  requestedBy: uuid("requested_by").notNull(),
  requestedRole: text("requested_role").notNull(),
  requestedAt: ts("requested_at").notNull(),
  deadline: ts("deadline").notNull(),
  closedAt: ts("closed_at"),
  outcome: text("outcome").$type<SupplementOutcome>(),
});

export const supplementItem = dossierSchema.table("supplement_item", {
  id: uuid("id").primaryKey(),
  requestId: uuid("request_id").notNull(),
  position: integer("position").notNull(),
  content: text("content").notNull(),
  criterionId: uuid("criterion_id"),
  legalDocumentTypeCode: text("legal_document_type_code"),
  response: text("response").notNull(),
  respondedAt: ts("responded_at"),
  respondedBy: uuid("responded_by"),
});

export const reminderSent = dossierSchema.table(
  "reminder_sent",
  {
    kind: text("kind").$type<ReminderKind>().notNull(),
    subjectId: uuid("subject_id").notNull(),
    contextId: uuid("context_id").notNull(),
    deadline: ts("deadline").notNull(),
    milestoneDays: integer("milestone_days").notNull(),
    sentAt: ts("sent_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.subjectId, t.contextId, t.deadline, t.milestoneDays] })],
);
