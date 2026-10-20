import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { emit } from "../platform/emit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import { roundNotFound } from "./manage";
import { assertDraftRound, type ChecklistItem, type Round } from "./model";

const MAX_ITEMS = 50;
const MAX_LABEL = 500;

/** An item as the round form sends it: an existing one keeps its `code`, a new one has none. */
export interface ChecklistItemInput {
  code?: string | null;
  label: string;
}

const invalid = (message: string) => new DomainError("invalid_checklist", message);

/** The items in the order given; a code not of this round is treated as a new item, so it gets a fresh one. */
function checkedItems(deps: CoreDeps, round: Round, items: readonly ChecklistItemInput[]): ChecklistItem[] {
  if (items.length === 0) throw invalid("Checklist sơ bộ cần ít nhất một mục");
  if (items.length > MAX_ITEMS) throw invalid(`Checklist sơ bộ có tối đa ${MAX_ITEMS} mục`);
  const known = new Set(round.checklist.map((i) => i.code));
  const seen = new Set<string>();
  return items.map((item) => {
    const label = typeof item.label === "string" ? item.label.trim() : "";
    if (!label) throw invalid("Nhập nội dung cho mọi mục của Checklist sơ bộ");
    if (label.length > MAX_LABEL) throw invalid(`Mỗi mục của Checklist sơ bộ dài tối đa ${MAX_LABEL} ký tự`);
    const code = item.code && known.has(item.code) ? item.code : deps.ids.next();
    if (seen.has(code)) throw invalid("Một mục của Checklist sơ bộ xuất hiện hai lần");
    seen.add(code);
    return { code, label };
  });
}

/**
 * L06 XA-04 (story 60): Cán bộ Sở sets the Checklist sơ bộ of a Nháp round: which items, worded how, in
 * which order. Once the round is opened the list is fixed, so every hồ sơ of it is assessed alike.
 */
export function configureChecklist(deps: CoreDeps) {
  return async (actor: Actor, input: { roundId: string; items: readonly ChecklistItemInput[] }): Promise<void> => {
    authorize(actor, "round.manage");
    return deps.uow.run(async (tx) => {
      assertIdShape(input.roundId, roundNotFound);
      const before = await tx.rounds.lock(input.roundId);
      if (!before) throw roundNotFound();
      assertDraftRound(before);
      const now = deps.clock.now();
      const after: Round = { ...before, checklist: checkedItems(deps, before, input.items), updatedAt: now };
      await tx.rounds.update(after);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "round.checklist_configured",
          targetType: "round",
          targetId: after.id,
          before: { checklist: before.checklist },
          after: { checklist: after.checklist },
        }),
      );
      await emit(deps, tx, { type: "round.checklist_configured", payload: { roundId: after.id } });
    });
  };
}
