import { boolean, date, integer, pgSchema, primaryKey, smallint, text, uuid } from "drizzle-orm/pg-core";
import { ts, pts } from "./columns";

export const criteria = pgSchema("criteria");

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
