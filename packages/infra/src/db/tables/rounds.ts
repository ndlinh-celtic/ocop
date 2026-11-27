import type { ChecklistItem } from "@ocop/core";
import { jsonb, pgSchema, smallint, text, uuid } from "drizzle-orm/pg-core";
import { ts, pts } from "./columns";

export const roundSchema = pgSchema("round");

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
