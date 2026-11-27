import type { CertificateState, DecisionKind, DecisionSection, FiveStarClosureOutcome, FiveStarPackageState, LetterCriterion } from "@ocop/core";
import { bigint, date, integer, jsonb, pgSchema, primaryKey, smallint, text, uuid } from "drizzle-orm/pg-core";
import { ts } from "./columns";

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

/** Gói đề nghị 5 sao (0053_five_star_package.sql, 0054, #89): pending → ready | failed, once; a ready one removed once. */
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
  removedAt: ts("removed_at"),
});
