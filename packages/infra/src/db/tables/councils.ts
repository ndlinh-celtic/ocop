import type { AssignmentKind } from "@ocop/core";
import { date, pgSchema, text, uuid } from "drizzle-orm/pg-core";
import { ts } from "./columns";

export const councilSchema = pgSchema("council");

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
