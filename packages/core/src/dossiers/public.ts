// The public interface of the dossiers module: what apps/web, apps/worker and packages/infra may use, re-exported by src/index.ts.
export {
  CHECKLIST_RESULT_LABEL,
  CHECKLIST_RESULTS,
  DOSSIER_STATE_LABEL,
  DOSSIER_STATES,
  dossierNotFound,
  EMPTY_PRODUCT,
  PRODUCT_FIELDS,
  type Dossier,
  type DossierEvent,
  type DossierRepo,
  type DossierState,
  type DossierStateRow,
  type ChecklistResult,
  type ChecklistResultValue,
  type CriterionEntry,
  type EvidenceFile,
  type EvidenceLink,
  type ProductField,
  type ProductInfo,
  PRODUCT_FIELD_LABEL,
  REQUIRED_PRODUCT_FIELDS,
  type Submission,
  type SubmissionFileRef,
  type SubmissionFileRole,
  type SubmissionSnapshot,
  type WardReport,
} from "./model";
export type { WardReportStatus } from "./ward-report";
export { DOSSIER_ACTIONS, TRANSITIONS, type DossierAction, type DossierEventType, type DossierRef, type TransitionRule } from "./transitions";
export type { CreationOptions } from "./create";
export type { UpdateProductInput } from "./edit";
export { ENTITY_FIELDS, type DossierFlag, type DossierListInput, type DossierSummary, type DossierView, type EntityField } from "./read";
export type { ExportedFile } from "./export";
export type { CriterionAssessment, SelfAssessment } from "./self-assessment";
export { SubmissionBlockedError, type SubmissionBlocker } from "./submit";
export type { ChecklistItemView, ChecklistResultInput, ChecklistSuggestion, DossierChecklist } from "./checklist";
export { SUBMISSION_DOCUMENTS, type SubmissionDocument } from "./documents";
export type { RequestSupplementInput, SupplementItemInput, SupplementRequestView } from "./supplement";
export type { SupplementItem, SupplementOutcome, SupplementRepo, SupplementRequest } from "./supplement-model";
export { isPastSupplementDeadline } from "./transitions";
export {
  PRELIMINARY_REJECTION_REASON_LABEL,
  PRELIMINARY_REJECTION_REASONS,
  rejectionOf,
  type DossierRejection,
  type PreliminaryRejectionReason,
  type RejectionGround,
} from "./model";
export type { RejectInput } from "./reject-transfer";
// #44: the province's view of hồ sơ, the Sở trả về and the đề nghị trả về of the xã.
export { FINISHED_STATES, type ReturnRequest } from "./model";
export { ADVISORY_RETURNABLE_STATES, type ReturnRequestView } from "./return-request";
export type { DossierOverviewRow } from "./read";
export { REMINDER_KINDS, type ReminderKind, type ReminderPayload, type ReminderRepo, type SentReminder } from "./reminder-model";
export { DEFAULT_REMINDER_MILESTONES, MAX_REMINDER_DAYS, MAX_REMINDER_MILESTONES } from "./reminder-milestones";
