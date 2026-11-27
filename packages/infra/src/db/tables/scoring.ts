import type { AdvisoryReportSnapshot, AggregateResult, EvidenceAssessment, FinalizedSnapshot, MeetingState, ScoreSheetState } from "@ocop/core";
import { boolean, date, integer, jsonb, numeric, pgSchema, primaryKey, smallint, text, uuid } from "drizzle-orm/pg-core";
import { ts } from "./columns";

export const scoringSchema = pgSchema("scoring");

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
