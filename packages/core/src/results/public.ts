// The public interface of the results module: what apps/web, apps/worker and packages/infra may use, re-exported by src/index.ts.
export { MAX_GENERAL_COMMENT, type EditGeneralCommentInput } from "./general-comment";
export { generalCommentVisible } from "./visibility";
export { DEFAULT_UNDERPERFORMING_RATIO, underperformingCriteria, type UnderperformingCriterion, type UnderperformingReason } from "./underperforming";
export {
  DECISION_KINDS,
  DECISION_SECTIONS,
  DECISION_SECTION_LABEL,
  recognizedStar,
  sectionOf,
  type DecisionKind,
  type DecisionSection,
  type RecognitionDecision,
  type RecognitionDecisionDossier,
  type RecognitionDecisionRepo,
} from "./decision-model";
export {
  MeetingPendingDossiersError,
  type DecisionView,
  type MeetingDecisionDossier,
  type MeetingDecisionView,
  type MeetingForDecision,
  type RecordedDecision,
  type RecordMeetingDecisionInput,
} from "./decision";
export type { SupplementaryDecisionInput, SupplementaryDecisionView } from "./supplementary-decision";
export {
  FIVE_STAR_CLOSURE_LABEL,
  FIVE_STAR_CLOSURE_OUTCOMES,
  type FiveStarCandidate,
  type FiveStarClosure,
  type FiveStarClosureOutcome,
  type FiveStarDispatch,
  type FiveStarRepo,
} from "./five-star-model";
export type { CloseFiveStarInput, FiveStarListInput, FiveStarRow, MarkFiveStarSentInput, ReturnFiveStarInput } from "./five-star";
export {
  CERTIFICATE_STATES,
  CERTIFICATE_STATE_LABEL,
  DEFAULT_CERTIFICATE_CODE_SUFFIX,
  DEFAULT_CERTIFICATE_EXPIRY_REMINDER_MONTHS,
  DEFAULT_CERTIFICATE_VALIDITY_MONTHS,
  certificateExpiry,
  formatCertificateCode,
  orderForNumbering,
  type Certificate,
  type CertificateFilter,
  type CertificateRepo,
  type CertificateSignedFile,
  type CertificateState,
} from "./certificate-model";
export { type CertificateView, type ListCertificatesInput, type UploadSignedCertificateInput } from "./certificate";
export { type AmendDecisionInput } from "./amend-decision";
export { type StarListInput } from "./star-list";
export { type CertificateSettings } from "./certificate-settings";
export { type LetterCriterion, type ResultLetter, type ResultLetterRepo } from "./result-letter-model";
export {
  LETTER_REASON_LABEL,
  MAX_ADVICE,
  MAX_CORRECTION_REASON,
  type IssuedLetter,
  type LetterView,
  type ResultLetterDraftView,
  type ResultLetterInput,
} from "./result-letter";
export { FIVE_STAR_PACKAGE_STATES, type FiveStarPackage, type FiveStarPackageRepo, type FiveStarPackageState } from "./five-star-package-model";
export { FIVE_STAR_PACKAGE_DAYS, type FiveStarPackageView, type RequestFiveStarPackageInput } from "./five-star-package";
