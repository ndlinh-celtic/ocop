import { authorize } from "../identity/policy";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assembleSet } from "./detail";
import { rankStoredSet, type StoredStarRank } from "./star-rank";

/*
 * Xem trước Bộ tiêu chí bằng chấm thử (spec #16, L19): Quản trị picks at most one Mức điểm per Tiêu chí and
 * sees the star rank the scoring would give, to check the extracted data before publishing. Nothing is stored:
 * the use case only reads, writes no audit row and emits no event.
 */

export interface PreviewSetInput {
  setId: string;
  /** Ids of the chosen Mức điểm; a Tiêu chí without a chosen level scores 0. */
  levelIds: readonly string[];
}

export function previewSet(deps: CoreDeps) {
  return async (actor: Actor, input: PreviewSetInput): Promise<StoredStarRank> => {
    authorize(actor, "criteria.preview");
    const { rows, thresholds } = await deps.uow.run(async (tx) => {
      const found = await tx.criteriaVersions.findSet(input.setId);
      if (!found) throw new DomainError("not_found", "Không tìm thấy bộ tiêu chí");
      return { rows: found.rows, thresholds: (await tx.criteriaVersions.taxonomy(found.versionId)).thresholds };
    });
    const set = assembleSet(rows);
    const owner = new Map(rows.levels.map((l) => [l.id, l]));
    const codeOf = new Map(rows.criteria.map((c) => [c.id, c.code]));
    // Keyed by Tiêu chí id, not code: a draft may still hold two Tiêu chí with the same code.
    const scores = new Map<string, number>();
    for (const id of input.levelIds) {
      const chosen = owner.get(id);
      if (!chosen) throw new DomainError("level_not_in_set", "Mức điểm đã chọn không thuộc bộ tiêu chí này");
      if (scores.has(chosen.criterionId))
        throw new DomainError("one_level_per_criterion", `Tiêu chí ${codeOf.get(chosen.criterionId)} chỉ được chọn một mức điểm`);
      scores.set(chosen.criterionId, chosen.points);
    }
    return rankStoredSet({ set, thresholds, scores });
  };
}
