// The public interface of the councils module: what apps/web, apps/worker and packages/infra may use, re-exported by src/index.ts.
export type { Council, CouncilRepo } from "./model";
export type { CouncilInput } from "./manage";
export { COUNCIL_ROLES, type CouncilDetail, type CouncilMember, type CouncilRole } from "./read";
export { ASSIGNMENT_KINDS, type Assignment, type AssignmentKind, type AssignmentRepo } from "./assignment-model";
export type { AssignmentCandidate, AssignmentView, EditAssignmentsInput } from "./assignments";
export type { StartGradingInput } from "./grading";
export type { AddAssignmentInput, ReplaceAssignmentInput, ReplacedAssignmentView } from "./replace";
