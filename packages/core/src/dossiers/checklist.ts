import { authorize } from "../identity/policy";
import type { Role } from "../identity/roles";
import { dataScopeOf } from "../identity/scope";
import type { ChecklistItem } from "../rounds/model";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { lockDossier } from "./edit";
import { CHECKLIST_RESULTS, dossierNotFound, type ChecklistResult, type ChecklistResultValue, type Dossier } from "./model";
import { transition } from "./transition";

/*
 * L06 XA-04 (stories 61, 62, 35): the Cán bộ xã assesses each item of the đợt's Checklist sơ bộ on a
 * received hồ sơ, and may change the results until the hồ sơ is gửi tỉnh. The system suggests "Đủ điều
 * kiện chuyển tỉnh" only when every item is Đạt; the decision stays with the Cán bộ xã.
 */

/** "Đủ điều kiện chuyển tỉnh" or "Chưa đủ". */
export type ChecklistSuggestion = "eligible" | "not_eligible";

export interface ChecklistItemView extends ChecklistItem {
  result: ChecklistResultValue | null;
  /** Nhận xét; absent for whoever may not read the xã's working notes (the Chủ thể, story 35). */
  comment?: string;
  assessedAt: Date | null;
}

export interface DossierChecklist {
  items: ChecklistItemView[];
  /** Every item has a result: one of the conditions of gửi tỉnh (story 66). */
  complete: boolean;
  suggestion: ChecklistSuggestion;
}

/** Vai trò that read nhận xét of the Checklist sơ bộ; never the Chủ thể. */
const READS_COMMENTS: readonly Role[] = ["ward_officer", "province_officer"];

const MAX_COMMENT = 2000;

/** The items of the hồ sơ's đợt with this hồ sơ's results; none before it is submitted into a đợt. */
export async function checklistOf(tx: Tx, dossier: Dossier): Promise<{ items: ChecklistItem[]; results: Map<string, ChecklistResult> }> {
  const round = dossier.roundId ? await tx.rounds.findById(dossier.roundId) : null;
  const results = new Map((await tx.dossiers.checklistResults(dossier.id)).map((r) => [r.itemCode, r]));
  return { items: round?.checklist ?? [], results };
}

export interface ChecklistResultInput {
  itemCode: string;
  result: ChecklistResultValue;
  comment?: string | null;
}

/**
 * Story 61: records the result of the items given (the others keep theirs). "Cần xác minh" must say what
 * is to be verified. A same-state row of the transition table, so it carries the version check, audit
 * and outbox, but stays off the timeline the Chủ thể reads.
 */
export function assessChecklist(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number; results: readonly ChecklistResultInput[] }): Promise<{ version: number }> => {
    authorize(actor, "dossier.write");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const { items } = await checklistOf(tx, before);
      const codes = new Set(items.map((i) => i.code));
      const now = deps.clock.now();
      const results: ChecklistResult[] = input.results.map((r) => {
        if (!codes.has(r.itemCode)) throw new DomainError("invalid_checklist_item", "Mục không thuộc Checklist sơ bộ của đợt");
        if (!CHECKLIST_RESULTS.includes(r.result)) throw new DomainError("invalid_checklist_result", "Chọn Đạt, Không đạt hoặc Cần xác minh");
        const comment = typeof r.comment === "string" ? r.comment.trim() : "";
        if (comment.length > MAX_COMMENT) throw new DomainError("field_too_long", "Nhận xét quá dài");
        if (r.result === "needs_verification" && !comment) throw new DomainError("comment_required", "Mục \"Cần xác minh\" phải có nhận xét về nội dung cần xác minh");
        return { dossierId: before.id, itemCode: r.itemCode, result: r.result, comment, assessedAt: now, assessedBy: actor.userId };
      });
      if (results.length === 0) throw new DomainError("invalid_checklist_result", "Đánh giá ít nhất một mục");
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.checklist.assess",
        expectedVersion: input.expectedVersion,
        metadata: { results: results.map((r) => ({ itemCode: r.itemCode, result: r.result, comment: r.comment })) },
      });
      for (const r of results) await tx.dossiers.saveChecklistResult(r);
      return { version: after.version };
    });
  };
}

/** Stories 61, 62: the Checklist sơ bộ of a hồ sơ within the reader's Phạm vi, with the suggestion. */
export function dossierChecklist(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<DossierChecklist> => {
    authorize(actor, "dossier.read");
    const scope = dataScopeOf(actor);
    const withComments = actor.activeRole !== null && READS_COMMENTS.includes(actor.activeRole);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      const { items, results } = await checklistOf(tx, dossier);
      const views = items.map((item): ChecklistItemView => {
        const r = results.get(item.code);
        return { ...item, result: r?.result ?? null, ...(withComments ? { comment: r?.comment ?? "" } : {}), assessedAt: r?.assessedAt ?? null };
      });
      const complete = views.length > 0 && views.every((v) => v.result !== null);
      return { items: views, complete, suggestion: complete && views.every((v) => v.result === "pass") ? "eligible" : "not_eligible" };
    });
  };
}
