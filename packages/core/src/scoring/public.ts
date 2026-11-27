// The public interface of the scoring module: what apps/web, apps/worker and packages/infra may use, re-exported by src/index.ts.
export {
  EVIDENCE_ASSESSMENTS,
  EVIDENCE_ASSESSMENT_LABEL,
  type AdvisoryReportDraft,
  type AdvisoryReportLine,
  type AdvisoryReportRepo,
  type AdvisoryReportSnapshot,
  type AdvisoryReportVersion,
  type EvidenceAssessment,
} from "./advisory-report-model";
export {
  AdvisoryReportIncomplete,
  type AdvisoryCriterionView,
  type AdvisoryReportContent,
  type AdvisoryReportLineInput,
  type AdvisoryReportVersionSummary,
  type AdvisoryReportVersionView,
  type AdvisoryReportWorkspace,
} from "./advisory-report";
export { SCORE_SHEET_STATES, type ScoreSheet, type ScoreSheetLine, type ScoreSheetRepo, type ScoreSheetState } from "./score-sheet-model";
export { ScoreSheetIncompleteError, type SaveScoreSheetInput, type ScoreSheetLineInput } from "./sheets";
export {
  AdvisoryCopyRefused,
  type AdvisoryCopyBoardRow,
  type AdvisoryCopyPlan,
  type AdvisoryCopyRecipient,
  type CopyAdvisoryInput,
  type CopySheetOutcome,
  type PreviewAdvisoryCopyInput,
} from "./advisory-copy";
export {
  scoresVisibility,
  type ConfirmedSheetsView,
  type DossierScores,
  type FullScoresView,
  type GraderProgress,
  type GraderScores,
  type GradingProgressRow,
  type OwnSheetView,
  type ScoresVisibility,
  type SheetCriterion,
  type VisibilityFacts,
} from "./read";
export { aggregateScores, type AggregateScores } from "./aggregate";
export type { AggregateOnlyView, AggregateSummaryRow, FinalizedResultView, PublishedLetter, PublishedResultView } from "./read";
export { FIVE_STAR_STANDING } from "./read";
export {
  MEETING_STATES,
  type AggregateResult,
  type AggregateResultRepo,
  type FinalizedSnapshot,
  type Meeting,
  type MeetingDossier,
  type MeetingMinutes,
  type MeetingRepo,
  type MeetingState,
  type SnapshotGrader,
  type UnlockRequest,
} from "./meeting-model";
export type { CreateMeetingInput, MeetingDossierView, MeetingMinutesView, MeetingSummary, MeetingView } from "./meetings";
export { snapshotHash, type FinalizeResult } from "./finalize";
export { MEETING_DOCUMENT_KINDS, MEETING_DOCUMENT_LABEL, type MeetingDocumentKind } from "./meeting-documents";
export { type ReturnScoreSheetInput, type SupersededSheet } from "./return-sheet";
export { type FinalizedResultSummary, type UnlockInput, type UnlockTarget, type UnlockView } from "./unlock";
