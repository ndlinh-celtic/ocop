export { createCore, type Core } from "./app";
export type { Clock, IdGen, PasswordHasher, SecretBox, TotpCheck, TotpService } from "./shared/ports";
export { DEFAULT_SETTINGS, type CoreDeps, type CoreSettings } from "./shared/deps";
export type { Repos, Tx, UnitOfWork } from "./shared/uow";
export { anonymousActor, systemActor, type Actor, type AnonymousActor, type RequestContext, type SystemActor, type UserActor } from "./shared/context";
export { DomainError } from "./shared/errors";
export type { AuditEntry, AuditFilter, AuditLog } from "./audit/audit";
export type { AuthMethod, RoleAssignment, Session, SessionStage, User, UserStatus } from "./identity/model";
export type { RoleAssignmentRepo, SessionRepo, UserRepo } from "./identity/repos";
export { ROLES, ROLE_LABEL, SCOPE_OF_ROLE, SCOPE_TYPES, TOTP_OPTIONAL_ROLES, type Role, type ScopeType } from "./identity/roles";
export { MIN_PASSWORD_LENGTH } from "./identity/password";
export { CONSUMER_NAMES, CONSUMERS, consumersFor, type ConsumerName } from "./platform/consumers";
export type { DomainEvent, EventType, Outbox, ProcessedEvents } from "./platform/events";
export type { DeliveryStatus, EmailDeliveries, EmailDelivery, EmailMessage, Mailer } from "./platform/mail";
export type { OneTimePurpose, OneTimeToken, OneTimeTokenRepo } from "./identity/tokens";
export { can, authorize, type Action } from "./identity/policy";
export type { GrantRoleInput } from "./identity/assignments";
export type { Ward, WardRepo } from "./org/ward";
export type { Notification, NotificationRepo } from "./notifications/notification";
export { REAUTH_WINDOW_MS, requireRecentAuth, type ReauthProof, type ReauthResult } from "./identity/reauth";
export type { FileStore, PresignedRequest } from "./files/file-store";
export { DEFAULT_ALLOWED_TYPES, FILE_PURPOSES, type FilePurpose, type FileRepo, type FileStatus, type StoredFile, type StoredFilePurpose } from "./files/model";
export {
  DOCX_TYPE,
  type DocumentRenderer,
  type DocumentTemplate,
  type DocumentTemplates,
  type RegistrationFormData,
  type SelfAssessmentReportData,
  type WardReportData,
} from "./documents/renderer";
export type { UploadInstructions } from "./files/uploads";
export { typeMatches, type FileInspection, type FileInspector } from "./files/inspection";
export { chainHash, GENESIS_HASH, SEAL_DELAY_MS, type ChainVerification } from "./audit/chain";
export type { AuditChainRepo, AuditSeal } from "./audit/chain-repo";
export {
  criteriaOf,
  STARS,
  type CriteriaSet,
  type Criterion,
  type CriterionGroup,
  type CriterionScores,
  type Part,
  type RankThresholds,
  type ScoreLevel,
  type Section,
  type Star,
} from "./criteria/model";
export {
  averageScores,
  rankStars,
  rankStoredSet,
  type PartTotal,
  type StarRank,
  type StarRankInput,
  type StoredStarRank,
  type StoredStarRankInput,
  type StoredUnmetMinimumStar,
  type UnmetMinimumStar,
} from "./criteria/star-rank";
export type {
  CriteriaSetRow,
  CriteriaVersion,
  CriteriaVersionRepo,
  CriterionGroupRow,
  CriterionRow,
  ExclusionConditionRow,
  PartRow,
  ProductGroupRow,
  ScoreLevelRow,
  SectionRow,
  SetRows,
  SubgroupRow,
  VersionRows,
  VersionStatus,
  VersionSummary,
  VersionTaxonomy,
  DraftNodeRows,
  VersionFields,
} from "./criteria/version";
export { assertDraft } from "./criteria/version";
export type {
  CriteriaSetDetail,
  ExclusionCondition,
  StoredCriterion,
  StoredCriterionGroup,
  StoredPart,
  StoredScoreLevel,
  StoredSection,
} from "./criteria/detail";
export { CriteriaImportError, QD26_THRESHOLDS, splitExclusions, type ImportIssue } from "./criteria/qd26-file";
export { MAX_IMPORT_BYTES, type ImportVersionInput } from "./criteria/import";
export { CriteriaValidationError } from "./criteria/publish";
export { draftEditSchema, type DraftEdit, type EditDraftInput } from "./criteria/edit";
export type { DraftChangeResult } from "./criteria/draft-change";
export {
  nodeAdditionSchema,
  type AddNodeInput,
  type AddNodeResult,
  type MoveDirection,
  type MoveNodeInput,
  type NodeAddition,
  type RemoveNodeInput,
} from "./criteria/structure";
export { DRAFT_NODE_KINDS, type DraftNodeKind, type DraftTarget, type DraftChangeAction, type DraftChangePayload } from "./criteria/draft-events";
export { findVersionIssues, type ValidationIssue, type ValidationIssueCode } from "./criteria/validation";
export type { PreviewSetInput } from "./criteria/preview";
export type { CriteriaSetView, TaxonomyGroup, TaxonomySet, TaxonomySubgroup, VersionDetail } from "./criteria/read";
export {
  AGGREGATION_METHODS,
  DEFAULT_CHECKLIST,
  endOfVnDay,
  EXTENDABLE_DEADLINE_LABEL,
  EXTENDABLE_DEADLINES,
  GRADING_MODE_LABEL,
  GRADING_MODES,
  isPastSubmissionDeadline,
  ROUND_STATUS_LABEL,
  ROUND_STATUSES,
  roundAlreadyOpen,
  vnDateOf,
  type AggregationMethod,
  type AggregationRule,
  type ChecklistItem,
  type DeadlineExtension,
  type DeadlineExtensionView,
  type ExtendableDeadline,
  type GradingMode,
  type Round,
  type RoundRepo,
  type RoundStatus,
} from "./rounds/model";
export type { RoundInput } from "./rounds/manage";
export type { ChecklistItemInput } from "./rounds/checklist";
export { roundActivity, type RoundActivity } from "./rounds/activity";
export type { ExtendDeadlineInput } from "./rounds/extension";
export type { RoundDetail, RoundView } from "./rounds/read";
export { dataScopeOf, type DataScope } from "./identity/scope";
export { onBehalfOf } from "./identity/on-behalf";
export {
  assertIdentifierShape,
  ENTITY_KIND_LABEL,
  ENTITY_KINDS,
  entityNotFound,
  maskPersonalId,
  normalizeIdentifier,
  parseDetails,
  type Entity,
  type EntityDetails,
  type EntityKind,
  type EntityRepo,
} from "./entities/model";
export type { EntityDetailView, EntityView } from "./entities/read";
export type { NewEntityInput, RegisterEntityInput } from "./entities/register";
export type { UpdateEntityInput } from "./entities/profile";
export {
  isExpired,
  legalDocumentNotFound,
  legalStanding,
  type LegalDocument,
  type LegalDocumentRecord,
  type LegalDocumentRepo,
  type LegalDocumentType,
  type LegalStanding,
  type Requirement,
  type RequirementState,
} from "./entities/legal";
export type { AddLegalDocumentInput, LegalDocumentView, LegalStandingView } from "./entities/legal-documents";
export type { RateLimit, RateLimitRepo } from "./platform/rate-limit";
export { consumeRateLimit } from "./platform/throttle";
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
} from "./dossiers/model";
export type { WardReportStatus } from "./dossiers/ward-report";
export { DOSSIER_ACTIONS, TRANSITIONS, type DossierAction, type DossierEventType, type DossierRef, type TransitionRule } from "./dossiers/transitions";
export type { CreationOptions } from "./dossiers/create";
export type { UpdateProductInput } from "./dossiers/edit";
export { ENTITY_FIELDS, type DossierFlag, type DossierListInput, type DossierSummary, type DossierView, type EntityField } from "./dossiers/read";
export type { CriterionAssessment, SelfAssessment } from "./dossiers/self-assessment";
export { SubmissionBlockedError, type SubmissionBlocker } from "./dossiers/submit";
export type { ChecklistItemView, ChecklistResultInput, ChecklistSuggestion, DossierChecklist } from "./dossiers/checklist";
export { SUBMISSION_DOCUMENTS, type SubmissionDocument } from "./dossiers/documents";
export type { RequestSupplementInput, SupplementItemInput, SupplementRequestView } from "./dossiers/supplement";
export type { SupplementItem, SupplementOutcome, SupplementRepo, SupplementRequest } from "./dossiers/supplement-model";
export { isPastSupplementDeadline } from "./dossiers/transitions";
export {
  PRELIMINARY_REJECTION_REASON_LABEL,
  PRELIMINARY_REJECTION_REASONS,
  rejectionOf,
  type DossierRejection,
  type PreliminaryRejectionReason,
  type RejectionGround,
} from "./dossiers/model";
export type { RejectInput } from "./dossiers/reject-transfer";
// #44: the province's view of hồ sơ, the Sở trả về and the đề nghị trả về of the xã.
export { FINISHED_STATES, type ReturnRequest } from "./dossiers/model";
export type { ReturnRequestView } from "./dossiers/return-request";
export type { DossierOverviewRow } from "./dossiers/read";
export { REMINDER_KINDS, type ReminderKind, type ReminderPayload, type ReminderRepo, type SentReminder } from "./dossiers/reminder-model";
export { DEFAULT_REMINDER_MILESTONES, MAX_REMINDER_DAYS, MAX_REMINDER_MILESTONES } from "./system/settings";
export type { SystemSettingRepo } from "./system/settings-model";
export type { Council, CouncilRepo } from "./councils/model";
export type { CouncilInput } from "./councils/manage";
export { COUNCIL_ROLES, type CouncilDetail, type CouncilMember, type CouncilRole } from "./councils/read";
export { ASSIGNMENT_KINDS, type Assignment, type AssignmentKind, type AssignmentRepo } from "./councils/assignment-model";
export type { AssignmentCandidate, AssignmentView, EditAssignmentsInput } from "./councils/assignments";
export type { StartGradingInput } from "./councils/grading";
export type { AddAssignmentInput, ReplaceAssignmentInput, ReplacedAssignmentView } from "./councils/replace";
export {
  EVIDENCE_ASSESSMENTS,
  EVIDENCE_ASSESSMENT_LABEL,
  type AdvisoryReportDraft,
  type AdvisoryReportLine,
  type AdvisoryReportRepo,
  type AdvisoryReportSnapshot,
  type AdvisoryReportVersion,
  type EvidenceAssessment,
} from "./scoring/advisory-report-model";
export {
  AdvisoryReportIncomplete,
  type AdvisoryCriterionView,
  type AdvisoryReportContent,
  type AdvisoryReportLineInput,
  type AdvisoryReportVersionSummary,
  type AdvisoryReportVersionView,
  type AdvisoryReportWorkspace,
} from "./scoring/advisory-report";
export { SCORE_SHEET_STATES, type ScoreSheet, type ScoreSheetLine, type ScoreSheetRepo, type ScoreSheetState } from "./scoring/score-sheet-model";
export { ScoreSheetIncompleteError, type SaveScoreSheetInput, type ScoreSheetLineInput } from "./scoring/sheets";
export {
  AdvisoryCopyRefused,
  type AdvisoryCopyBoardRow,
  type AdvisoryCopyPlan,
  type AdvisoryCopyRecipient,
  type CopyAdvisoryInput,
  type CopySheetOutcome,
  type PreviewAdvisoryCopyInput,
} from "./scoring/advisory-copy";
export { scoresVisibility, type DossierScores, type FullScoresView, type GraderProgress, type GraderScores, type GradingProgressRow, type OwnSheetView, type ScoresVisibility, type SheetCriterion, type VisibilityFacts } from "./scoring/read";
export { aggregateScores, type AggregateScores } from "./scoring/aggregate";
export type { AggregateOnlyView, FinalizedResultView } from "./scoring/read";
export { MEETING_STATES, type AggregateResult, type AggregateResultRepo, type FinalizedSnapshot, type Meeting, type MeetingDossier, type MeetingRepo, type MeetingState, type SnapshotGrader } from "./scoring/meeting-model";
export type { CreateMeetingInput, MeetingDossierView, MeetingSummary, MeetingView } from "./scoring/meetings";
export { snapshotHash, type FinalizeResult } from "./scoring/finalize";
