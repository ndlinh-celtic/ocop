import { auditEntry } from "../audit/audit";
import { emit } from "../platform/emit";
import type { UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import type { Tx } from "../shared/uow";
import type { DraftChangeAction, DraftNodeKind, DraftTarget } from "./draft-events";
import { versionNotFound } from "./helpers";
import { findVersionIssues, type ValidationIssue } from "./validation";
import { assertDraft, type CriteriaVersion, type DraftNodeRows, type VersionRows } from "./version";

/*
 * The frame every change to a draft Phiên bản tiêu chí runs in (L19 AD-03): edit (#22) and add, remove,
 * reorder (#23) differ only in the `apply` step.
 */

/** What one change did, for the audit row and the outbox event. Fields are only the ones that changed. */
export interface DraftChange {
  action: DraftChangeAction;
  node: DraftTarget;
  /** The node's id; the version id for "version" and "thresholds". */
  nodeId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  /** The version's rows after the change when `apply` already has them (structure changes), so they are not loaded again. */
  rowsAfter?: VersionRows;
}

export interface DraftChangeResult {
  /** The check of the whole version after the change (AD-04), so the list of problems stays current. */
  issues: ValidationIssue[];
}

/**
 * Locks the version (SELECT … FOR UPDATE, so changes to one draft run one at a time), refuses a published one,
 * runs `apply`, writes the audit row and outbox event in the same transaction, then re-runs the check.
 * `apply` returns null when nothing changed: no audit row and no event then. `rows()` gives `apply` the whole
 * tree, loaded once; the check runs on `rowsAfter` when `apply` returns it, and loads the tree otherwise.
 * The caller has already authorized the actor.
 */
export function changeDraft(
  deps: CoreDeps,
  actor: UserActor,
  versionId: string,
  apply: (tx: Tx, version: CriteriaVersion, rows: () => Promise<VersionRows>) => Promise<DraftChange | null>,
): Promise<DraftChangeResult> {
  return deps.uow.run(async (tx) => {
    const version = await tx.criteriaVersions.lock(versionId);
    if (!version) throw versionNotFound();
    assertDraft(version);
    let loaded: Promise<VersionRows> | undefined;
    const rows = () => (loaded ??= tx.criteriaVersions.loadRows(version.id));
    const change = await apply(tx, version, rows);
    if (change) {
      const now = deps.clock.now();
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: change.action,
          targetType: "criteria_version",
          targetId: version.id,
          before: change.before,
          after: change.after,
          metadata: { node: change.node, nodeId: change.nodeId, ...change.metadata },
        }),
      );
      await emit(deps, tx, { type: change.action, payload: { versionId: version.id, node: change.node, nodeId: change.nodeId } });
    }
    // Unchanged, the tree `apply` may have loaded is still current; changed, it is stale unless `apply` updated it.
    const after = change ? (change.rowsAfter ?? (await tx.criteriaVersions.loadRows(version.id))) : await rows();
    return { issues: findVersionIssues(after) };
  });
}

/** A node of the given draft, or `not_found` when it does not exist or belongs to another version. */
export async function findDraftNode<K extends DraftNodeKind>(tx: Tx, version: CriteriaVersion, kind: K, id: string): Promise<DraftNodeRows[K]> {
  const found = await tx.criteriaVersions.findNode(kind, id);
  if (!found || found.versionId !== version.id) throw new DomainError("not_found", "Không tìm thấy mục cần sửa trong bản nháp");
  return found.row;
}
