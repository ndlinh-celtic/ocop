import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { emit } from "../platform/emit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import { roundNotFound } from "./manage";
import type { Round } from "./model";

/**
 * L09 HD-01 stories 10, 11: Cán bộ Sở gán the Hội đồng responsible for a Đợt đánh giá, in any Trạng thái
 * đợt, and may change it until the đợt's first Giao chấm (its first phiếu chấm, as RoundActivity reports
 * it), so no Phân công or phiếu is left pointing at a Hội đồng that no longer has the đợt.
 */
export function assignCouncil(deps: CoreDeps) {
  return async (actor: Actor, input: { roundId: string; councilId: string }): Promise<void> => {
    authorize(actor, "round.council.assign");
    return deps.uow.run(async (tx) => {
      assertIdShape(input.roundId, roundNotFound);
      const before = await tx.rounds.lock(input.roundId);
      if (!before) throw roundNotFound();
      const councilNotFound = () => new DomainError("council_not_found", "Không tìm thấy hội đồng");
      assertIdShape(input.councilId, councilNotFound);
      const council = await tx.councils.findById(input.councilId);
      if (!council) throw councilNotFound();
      if (before.councilId === council.id) return;
      if (await deps.roundActivity.hasScoreSheets(tx, before.id)) {
        throw new DomainError("round_council_locked", "Đợt đã có hồ sơ được Giao chấm, không đổi được hội đồng");
      }
      const now = deps.clock.now();
      const after: Round = { ...before, councilId: council.id, updatedAt: now };
      await tx.rounds.update(after);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "round.council_assigned",
          targetType: "round",
          targetId: after.id,
          before: { councilId: before.councilId },
          after: { councilId: after.councilId },
          metadata: { status: after.status },
        }),
      );
      await emit(deps, tx, { type: "round.council_assigned", payload: { roundId: after.id, fromCouncilId: before.councilId, toCouncilId: council.id } });
    });
  };
}
