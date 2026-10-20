/*
 * Vocabulary of changes to a draft Phiên bản tiêu chí (L19 AD-03), shared by the use cases, the repo port
 * and the outbox events. It imports nothing, so platform/events.ts can depend on it without a cycle.
 */

/** The nodes of the tree, by the row type that stores them (version.ts `DraftNodeRows`). */
export const DRAFT_NODE_KINDS = [
  "productGroup",
  "subgroup",
  "set",
  "exclusion",
  "part",
  "section",
  "criterionGroup",
  "criterion",
  "scoreLevel",
] as const;
export type DraftNodeKind = (typeof DRAFT_NODE_KINDS)[number];

/** What a change applies to: the version's own fields, its Ngưỡng hạng, or one node of the tree. */
export type DraftTarget = "version" | "thresholds" | DraftNodeKind;

/**
 * Audit action and outbox event type of a change to a draft (one string for both, like
 * `criteria.version.published`). Ticket #23 adds e.g. "criteria.draft.node_added" here.
 */
export type DraftChangeAction = "criteria.draft.edited";

export interface DraftChangePayload {
  versionId: string;
  node: DraftTarget;
  /** The node's id; the version id when `node` is "version" or "thresholds". */
  nodeId: string;
}
