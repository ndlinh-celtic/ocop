// The public interface of the criteria module: what apps/web, apps/worker and packages/infra may use, re-exported by src/index.ts.
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
} from "./model";
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
} from "./star-rank";
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
} from "./version";
export { assertDraft } from "./version";
export type { CriteriaSetDetail, ExclusionCondition, StoredCriterion, StoredCriterionGroup, StoredPart, StoredScoreLevel, StoredSection } from "./detail";
export { CriteriaImportError, QD26_THRESHOLDS, splitExclusions, type ImportIssue } from "./qd26-file";
export { MAX_IMPORT_BYTES, type ImportVersionInput } from "./import";
export { CriteriaValidationError } from "./publish";
export { draftEditSchema, type DraftEdit, type EditDraftInput } from "./edit";
export type { DraftChangeResult } from "./draft-change";
export {
  nodeAdditionSchema,
  type AddNodeInput,
  type AddNodeResult,
  type MoveDirection,
  type MoveNodeInput,
  type NodeAddition,
  type RemoveNodeInput,
} from "./structure";
export { DRAFT_NODE_KINDS, type DraftNodeKind, type DraftTarget, type DraftChangeAction, type DraftChangePayload } from "./draft-events";
export { findVersionIssues, type ValidationIssue, type ValidationIssueCode } from "./validation";
export type { PreviewSetInput } from "./preview";
export type { CriteriaSetView, TaxonomyGroup, TaxonomySet, TaxonomySubgroup, VersionDetail } from "./read";
