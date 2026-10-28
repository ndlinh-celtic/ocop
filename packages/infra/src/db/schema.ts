import type {
  AssignmentKind,
  ScoreSheetState,
  ChecklistItem,
  ChecklistResultValue,
  DossierState,
  ReminderKind,
  StoredFilePurpose,
  SubmissionFileRole,
  SubmissionSnapshot,
  SupplementOutcome,
} from "@ocop/core";
import type { AdvisoryReportSnapshot, EvidenceAssessment } from "@ocop/core";
import type { AggregateResult, FinalizedSnapshot, MeetingState } from "@ocop/core";
import type { DocumentTemplate } from "@ocop/core";
import type { DecisionKind, DecisionSection } from "@ocop/core";
import type { FiveStarClosureOutcome } from "@ocop/core";
import type { CertificateState, LetterCriterion } from "@ocop/core";
import type { FiveStarPackageState } from "@ocop/core";
import { bigint, boolean, date, integer, jsonb, numeric, pgSchema, primaryKey, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Mirrors the reviewed SQL in migrations/; the SQL is the source of truth.
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const identity = pgSchema("identity");
export const platform = pgSchema("platform");
export const org = pgSchema("org");
export const criteria = pgSchema("criteria");
export const roundSchema = pgSchema("round");
export const entitySchema = pgSchema("entity");
export const councilSchema = pgSchema("council");
export const scoringSchema = pgSchema("scoring");

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

// Phiên bản tiêu chí (0010_criteria.sql). Points are numeric(7,2), read as JS numbers.
const pts = (name: string) => numeric(name, { precision: 7, scale: 2, mode: "number" });

export const criteriaVersion = criteria.table("version", {
  id: uuid("id").primaryKey(),
  legalBasis: text("legal_basis").notNull(),
  issuedOn: date("issued_on", { mode: "string" }).notNull(),
  effectiveOn: date("effective_on", { mode: "string" }).notNull(),
  status: text("status").$type<"draft" | "published">().notNull(),
  createdAt: ts("created_at").notNull(),
  createdBy: uuid("created_by"),
  publishedAt: ts("published_at"),
  publishedBy: uuid("published_by"),
  copiedFrom: uuid("copied_from"),
});

export const rankThreshold = criteria.table(
  "rank_threshold",
  {
    versionId: uuid("version_id").notNull(),
    stars: smallint("stars").$type<2 | 3 | 4 | 5>().notNull(),
    minScore: pts("min_score").notNull(),
  },
  (t) => [primaryKey({ columns: [t.versionId, t.stars] })],
);

export const productGroup = criteria.table("product_group", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id").notNull(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
});

export const productSubgroup = criteria.table("product_subgroup", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id").notNull(),
  productGroupId: uuid("product_group_id").notNull(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
});

export const criteriaSet = criteria.table("criteria_set", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id").notNull(),
  subgroupId: uuid("subgroup_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  totalPoints: pts("total_points").notNull(),
  headerNote: text("header_note").notNull(),
  footerNote: text("footer_note").notNull(),
  extractionNote: text("extraction_note").notNull(),
  sourcePages: integer("source_pages").array().notNull(),
  position: integer("position").notNull(),
});

export const exclusionCondition = criteria.table("exclusion_condition", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id").notNull(),
  setId: uuid("set_id").notNull(),
  description: text("description").notNull(),
  position: integer("position").notNull(),
});

export const criteriaPart = criteria.table("part", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id").notNull(),
  setId: uuid("set_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  points: pts("points").notNull(),
  position: integer("position").notNull(),
});

export const criteriaSection = criteria.table("section", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id").notNull(),
  setId: uuid("set_id").notNull(),
  partId: uuid("part_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  points: pts("points").notNull(),
  position: integer("position").notNull(),
});

export const criterionGroup = criteria.table("criterion_group", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id").notNull(),
  setId: uuid("set_id").notNull(),
  sectionId: uuid("section_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  points: pts("points").notNull(),
  position: integer("position").notNull(),
});

export const criterion = criteria.table("criterion", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id").notNull(),
  setId: uuid("set_id").notNull(),
  sectionId: uuid("section_id").notNull(),
  groupId: uuid("group_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  requirement: text("requirement").notNull(),
  maxPoints: pts("max_points").notNull(),
  note: text("note").notNull(),
  extractionNote: text("extraction_note").notNull(),
  position: integer("position").notNull(),
});

export const scoreLevel = criteria.table("score_level", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id").notNull(),
  setId: uuid("set_id").notNull(),
  criterionId: uuid("criterion_id").notNull(),
  description: text("description").notNull(),
  points: pts("points").notNull(),
  minimumStar: smallint("min_star").$type<1 | 2 | 3 | 4 | 5>(),
  branch: text("branch"),
  systemAdded: boolean("system_added").notNull(),
  position: integer("position").notNull(),
});

// Đợt đánh giá (0012_rounds.sql).
export const round = roundSchema.table("round", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  year: smallint("year").notNull(),
  status: text("status").$type<"draft" | "open_for_submission" | "submission_closed" | "ended">().notNull(),
  criteriaVersionId: uuid("criteria_version_id").notNull(),
  submissionDeadline: ts("submission_deadline").notNull(),
  forwardingDeadline: ts("forwarding_deadline").notNull(),
  evaluationDeadline: ts("evaluation_deadline").notNull(),
  gradingMode: text("grading_mode").$type<"direct" | "advisory_based">().notNull(),
  aggregationMethod: text("aggregation_method").$type<"mean">().notNull(),
  minGraders: smallint("min_graders").notNull(),
  deviationFlagPoints: pts("deviation_flag_points").notNull(),
  checklist: jsonb("checklist").$type<ChecklistItem[]>().notNull(),
  createdAt: ts("created_at").notNull(),
  createdBy: uuid("created_by").notNull(),
  updatedAt: ts("updated_at").notNull(),
  openedAt: ts("opened_at"),
  openedBy: uuid("opened_by"),
  submissionClosedAt: ts("submission_closed_at"),
  endedAt: ts("ended_at"),
  endedBy: uuid("ended_by"),
  // 0028_councils.sql
  councilId: uuid("council_id"),
});

// Hội đồng (0028_councils.sql).
export const council = councilSchema.table("council", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  decisionNumber: text("decision_number").notNull(),
  decisionDate: date("decision_date", { mode: "string" }).notNull(),
  decisionFileId: uuid("decision_file_id").notNull(),
  leaderUserId: uuid("leader_user_id"),
  createdAt: ts("created_at").notNull(),
  createdBy: uuid("created_by").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

// Phân công (0030_assignments.sql).
export const assignment = councilSchema.table("assignment", {
  id: uuid("id").primaryKey(),
  dossierId: uuid("dossier_id").notNull(),
  userId: uuid("user_id").notNull(),
  kind: text("kind").$type<AssignmentKind>().notNull(),
  createdBy: uuid("created_by").notNull(),
  createdAt: ts("created_at").notNull(),
  effectiveAt: ts("effective_at"),
  replacedAt: ts("replaced_at"),
  replacedBy: uuid("replaced_by"),
  replaceReason: text("replace_reason"),
});

// Phiếu chấm (0031_grading.sql).
export const scoreSheet = scoringSchema.table("score_sheet", {
  id: uuid("id").primaryKey(),
  dossierId: uuid("dossier_id").notNull(),
  assignmentId: uuid("assignment_id").notNull(),
  attempt: integer("attempt").notNull(),
  state: text("state").$type<ScoreSheetState>().notNull(),
  confirmedAt: ts("confirmed_at"),
  reauthMethod: text("reauth_method").$type<"totp" | "password">(),
  supersededBy: uuid("superseded_by"),
  supersededReason: text("superseded_reason"),
  awaitingCopy: boolean("awaiting_copy").notNull(),
  version: integer("version").notNull(),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

// Dòng chấm of a Phiếu chấm and their bằng chứng kiểm tra (0032_score_sheet_lines.sql).
export const scoreSheetLine = scoringSchema.table(
  "score_sheet_line",
  {
    scoreSheetId: uuid("score_sheet_id").notNull(),
    criterionId: uuid("criterion_id").notNull(),
    scoreLevelId: uuid("score_level_id"),
    comment: text("comment").notNull(),
    source: text("source").$type<"member" | "advisory">().notNull(),
    advisoryVersionId: uuid("advisory_version_id"),
    advisoryLevelOriginal: uuid("advisory_level_original"),
    adjustReason: text("adjust_reason"),
    edited: boolean("edited").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.scoreSheetId, t.criterionId] })],
);
export const scoreSheetLineFile = scoringSchema.table(
  "score_sheet_line_file",
  {
    scoreSheetId: uuid("score_sheet_id").notNull(),
    criterionId: uuid("criterion_id").notNull(),
    fileId: uuid("file_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.scoreSheetId, t.criterionId, t.fileId] })],
);

// Gia hạn đợt history, append-only (0013_round_deadline_extension.sql; 0016 drops `reopened`).
export const deadlineExtension = roundSchema.table("deadline_extension", {
  id: uuid("id").primaryKey(),
  roundId: uuid("round_id").notNull(),
  deadline: text("deadline").$type<"submission" | "forwarding" | "evaluation">().notNull(),
  previousDeadline: ts("previous_deadline").notNull(),
  newDeadline: ts("new_deadline").notNull(),
  reason: text("reason").notNull(),
  extendedBy: uuid("extended_by").notNull(),
  extendedAt: ts("extended_at").notNull(),
});

export const entity = entitySchema.table("entity", {
  id: uuid("id").primaryKey(),
  kind: text("kind").$type<"enterprise" | "cooperative" | "household">().notNull(),
  name: text("name").notNull(),
  identifierFingerprint: text("identifier_fingerprint").notNull(),
  taxCode: text("tax_code"),
  personalIdSealed: text("personal_id_sealed"),
  personalIdLast4: text("personal_id_last4"),
  address: text("address").notNull(),
  representativeName: text("representative_name").notNull(),
  phone: text("phone").notNull(),
  wardId: uuid("ward_id").notNull(),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const legalDocumentType = entitySchema.table("legal_document_type", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  requiredFor: text("required_for").array().$type<("enterprise" | "cooperative" | "household")[]>().notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const legalDocument = entitySchema.table("legal_document", {
  id: uuid("id").primaryKey(),
  entityId: uuid("entity_id").notNull(),
  typeCode: text("type_code").notNull(),
  documentNumber: text("document_number"),
  issuedOn: date("issued_on", { mode: "string" }).notNull(),
  validUntil: date("valid_until", { mode: "string" }),
  fileId: uuid("file_id").notNull(),
  addedBy: uuid("added_by").notNull(),
  addedAt: ts("added_at").notNull(),
  replacedBy: uuid("replaced_by"),
  replacedAt: ts("replaced_at"),
});

export const rateLimitHit = platform.table("rate_limit_hit", {
  bucket: text("bucket").notNull(),
  subjectHash: text("subject_hash").notNull(),
  occurredAt: ts("occurred_at").notNull(),
});

// Hồ sơ (0019_dossiers.sql).
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

// Cấu hình chung and the ledger of nhắc hạn (0026_due_reminders.sql).
export const systemSetting = platform.table("system_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull(),
  updatedBy: uuid("updated_by").notNull(),
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

// Báo cáo Tổ tư vấn (0033_advisory_reports.sql).
export const advisoryReportDraft = scoringSchema.table("advisory_report_draft", {
  dossierId: uuid("dossier_id").primaryKey(),
  version: integer("version").notNull(),
  summary: text("summary").notNull(),
  notes: text("notes").notNull(),
  attachmentFileIds: uuid("attachment_file_ids").array().notNull(),
  updatedAt: ts("updated_at").notNull(),
  updatedBy: uuid("updated_by").notNull(),
});

export const advisoryReportLine = scoringSchema.table(
  "advisory_report_line",
  {
    dossierId: uuid("dossier_id").notNull(),
    criterionId: uuid("criterion_id").notNull(),
    levelId: uuid("level_id"),
    basis: text("basis").notNull(),
    evidenceFileIds: uuid("evidence_file_ids").array().notNull(),
    evidenceAssessment: text("evidence_assessment").$type<EvidenceAssessment>(),
  },
  (t) => [primaryKey({ columns: [t.dossierId, t.criterionId] })],
);

export const advisoryReportVersion = scoringSchema.table("advisory_report_version", {
  id: uuid("id").primaryKey(),
  dossierId: uuid("dossier_id").notNull(),
  number: integer("number").notNull(),
  snapshot: jsonb("snapshot").$type<AdvisoryReportSnapshot>().notNull(),
  issuedBy: uuid("issued_by").notNull(),
  issuedAt: ts("issued_at").notNull(),
  reason: text("reason"),
});

// Phiên họp and kết quả chốt (0038_meetings_and_finalize.sql).
export const meeting = scoringSchema.table("meeting", {
  id: uuid("id").primaryKey(),
  councilId: uuid("council_id").notNull(),
  roundId: uuid("round_id").notNull(),
  title: text("title").notNull(),
  heldOn: date("held_on", { mode: "string" }).notNull(),
  location: text("location").notNull(),
  state: text("state").$type<MeetingState>().notNull(),
  createdBy: uuid("created_by").notNull(),
  createdAt: ts("created_at").notNull(),
  closedBy: uuid("closed_by"),
  closedAt: ts("closed_at"),
});

export const meetingDossier = scoringSchema.table(
  "meeting_dossier",
  {
    meetingId: uuid("meeting_id").notNull(),
    dossierId: uuid("dossier_id").notNull(),
    addedBy: uuid("added_by").notNull(),
    addedAt: ts("added_at").notNull(),
    resultId: uuid("result_id"),
  },
  (t) => [primaryKey({ columns: [t.meetingId, t.dossierId] })],
);

export const aggregateResult = scoringSchema.table("aggregate_result", {
  id: uuid("id").primaryKey(),
  dossierId: uuid("dossier_id").notNull(),
  n: integer("n").notNull(),
  meetingId: uuid("meeting_id").notNull(),
  criteriaVersionId: uuid("criteria_version_id").notNull(),
  total: numeric("total", { mode: "number" }).notNull(),
  star: smallint("star").notNull(),
  parts: jsonb("parts").$type<AggregateResult["parts"]>().notNull(),
  averages: jsonb("averages").$type<Record<string, number>>().notNull(),
  unmet: jsonb("unmet").$type<AggregateResult["unmet"]>().notNull(),
  deviation: numeric("deviation", { mode: "number" }).notNull(),
  flagged: boolean("flagged").notNull(),
  countedSheetIds: uuid("counted_sheet_ids").array().notNull(),
  absentSheetIds: uuid("absent_sheet_ids").array().notNull(),
  snapshot: jsonb("snapshot").$type<FinalizedSnapshot>().notNull(),
  sha256: text("sha256").notNull(),
  finalizedBy: uuid("finalized_by").notNull(),
  finalizedAt: ts("finalized_at").notNull(),
  reauthMethod: text("reauth_method").$type<"totp" | "password">().notNull(),
  supersededAt: ts("superseded_at"),
  supersededByUnlock: uuid("superseded_by_unlock"),
});

// Biên bản đã ký of a Phiên họp (0040_meeting_minutes.sql): insert only.
export const meetingMinutes = scoringSchema.table("meeting_minutes", {
  id: uuid("id").primaryKey(),
  meetingId: uuid("meeting_id").notNull(),
  number: integer("number").notNull(),
  fileId: uuid("file_id").notNull(),
  uploadedBy: uuid("uploaded_by").notNull(),
  uploadedAt: ts("uploaded_at").notNull(),
});

/** Mở khóa sau chốt (#63): append-only; the kết quả it superseded points back at it. */
export const unlockRequest = scoringSchema.table("unlock_request", {
  id: uuid("id").primaryKey(),
  dossierId: uuid("dossier_id").notNull(),
  resultId: uuid("result_id").notNull(),
  requestFileId: uuid("request_file_id").notNull(),
  requestedBy: text("requested_by").notNull(),
  reason: text("reason").notNull(),
  unlockedBy: uuid("unlocked_by").notNull(),
  unlockedAt: ts("unlocked_at").notNull(),
  reauthMethod: text("reauth_method").$type<"totp" | "password">().notNull(),
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

export const resultsSchema = pgSchema("results");

/** Quyết định công nhận (0047_recognition_decision.sql, #83): never removed; one per Phiên họp. */
export const recognitionDecision = resultsSchema.table("recognition_decision", {
  id: uuid("id").primaryKey(),
  kind: text("kind").$type<DecisionKind>().notNull(),
  meetingId: uuid("meeting_id"),
  number: text("number").notNull(),
  signedOn: date("signed_on", { mode: "string" }).notNull(),
  fileId: uuid("file_id").notNull(),
  recordedBy: uuid("recorded_by").notNull(),
  recordedAt: ts("recorded_at").notNull(),
});

/** The hồ sơ of a Quyết định công nhận with their mục: append-only. */
export const recognitionDecisionDossier = resultsSchema.table(
  "recognition_decision_dossier",
  {
    decisionId: uuid("decision_id").notNull(),
    dossierId: uuid("dossier_id").notNull(),
    section: text("section").$type<DecisionSection>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.decisionId, t.dossierId] })],
);

/** Đánh dấu đã gửi đề nghị 5 sao (0051_five_star_proposal.sql, #87): append-only, one per hồ sơ. */
export const fiveStarDispatch = resultsSchema.table("five_star_dispatch", {
  dossierId: uuid("dossier_id").primaryKey(),
  dispatchNumber: text("dispatch_number").notNull(),
  sentOn: date("sent_on", { mode: "string" }).notNull(),
  recordedBy: uuid("recorded_by").notNull(),
  recordedAt: ts("recorded_at").notNull(),
});

/** Đóng hồ sơ đề nghị 5 sao on the Bộ's answer (0051_five_star_proposal.sql, #87): append-only, one per hồ sơ. */
export const fiveStarClosure = resultsSchema.table("five_star_closure", {
  dossierId: uuid("dossier_id").primaryKey(),
  outcome: text("outcome").$type<FiveStarClosureOutcome>().notNull(),
  decisionNumber: text("decision_number"),
  decidedOn: date("decided_on", { mode: "string" }),
  fileId: uuid("file_id").notNull(),
  closedBy: uuid("closed_by").notNull(),
  closedAt: ts("closed_at").notNull(),
});
/** Số thứ tự of Giấy chứng nhận per year (0048_certificate.sql, #84). */
export const certCounter = resultsSchema.table("cert_counter", {
  year: integer("year").primaryKey(),
  lastSeq: integer("last_seq").notNull(),
});

/** Giấy chứng nhận (0048_certificate.sql, #84): never removed; số hiệu and Hạng công nhận never change. */
export const certificate = resultsSchema.table("certificate", {
  id: uuid("id").primaryKey(),
  dossierId: uuid("dossier_id").notNull(),
  decisionId: uuid("decision_id").notNull(),
  year: integer("year").notNull(),
  seq: integer("seq").notNull(),
  code: text("code").notNull(),
  recognizedStar: smallint("recognized_star").notNull(),
  issuedOn: date("issued_on", { mode: "string" }).notNull(),
  expiresOn: date("expires_on", { mode: "string" }).notNull(),
  state: text("state").$type<CertificateState>().notNull(),
  draftFileId: uuid("draft_file_id"),
  templateVersionId: uuid("template_version_id"),
  issuedAt: ts("issued_at").notNull(),
});

/** Every signed PDF uploaded for a Giấy chứng nhận: append-only. */
export const certificateSignedFile = resultsSchema.table(
  "certificate_signed_file",
  {
    certificateId: uuid("certificate_id").notNull(),
    n: integer("n").notNull(),
    fileId: uuid("file_id").notNull(),
    reason: text("reason"),
    uploadedBy: uuid("uploaded_by").notNull(),
    uploadedAt: ts("uploaded_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.certificateId, t.n] })],
);

/** Thư kết quả không đạt (0049_result_letter.sql, #85): insert only; a thư đính chính is the next n. */
export const resultLetter = resultsSchema.table("result_letter", {
  id: uuid("id").primaryKey(),
  dossierId: uuid("dossier_id").notNull(),
  n: integer("n").notNull(),
  criteria: jsonb("criteria").$type<LetterCriterion[]>().notNull(),
  advice: text("advice").notNull(),
  reason: text("reason"),
  fileId: uuid("file_id").notNull(),
  templateVersionId: uuid("template_version_id"),
  issuedBy: uuid("issued_by").notNull(),
  issuedAt: ts("issued_at").notNull(),
});

/** Gói đề nghị 5 sao (0053_five_star_package.sql, #89): pending → ready | failed, once. */
export const fiveStarPackage = resultsSchema.table("five_star_package", {
  id: uuid("id").primaryKey(),
  requestedBy: uuid("requested_by").notNull(),
  requestedAt: ts("requested_at").notNull(),
  dossierIds: uuid("dossier_ids").array().notNull(),
  state: text("state").$type<FiveStarPackageState>().notNull(),
  storageKey: text("storage_key"),
  size: bigint("size", { mode: "number" }),
  expiresAt: ts("expires_at"),
  completedAt: ts("completed_at"),
  failure: text("failure"),
});
