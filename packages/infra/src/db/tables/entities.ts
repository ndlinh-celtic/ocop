import { date, integer, pgSchema, text, uuid } from "drizzle-orm/pg-core";
import { ts } from "./columns";

export const entitySchema = pgSchema("entity");

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
