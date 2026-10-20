import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { emit } from "../platform/emit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { checkedAggregation, roundNotFound, sameAggregation } from "./manage";
import { GRADING_MODES, type AggregationRule, type GradingMode, type Round } from "./model";

/**
 * Chế độ chấm and Quy tắc tổng hợp change after opening only while the round is Đang nhận nộp or
 * Đã đóng nộp, and only until its first phiếu chấm (spec #16 stories 49-50). A Nháp round is edited as a whole.
 */
async function lockConfigurable(deps: CoreDeps, tx: Tx, roundId: string): Promise<Round> {
  assertIdShape(roundId, roundNotFound);
  const round = await tx.rounds.lock(roundId);
  if (!round) throw roundNotFound();
  if (round.status !== "open_for_submission" && round.status !== "submission_closed") {
    throw new DomainError("round_not_configurable", "Chỉ đổi được cấu hình khi đợt Đang nhận nộp hoặc Đã đóng nộp");
  }
  if (await deps.roundActivity.hasScoreSheets(tx, round.id)) {
    throw new DomainError("round_has_score_sheets", "Đợt đã có phiếu chấm, không đổi được Chế độ chấm và Quy tắc tổng hợp");
  }
  return round;
}

/** L07 HD-06: Cán bộ Sở changes the Chế độ chấm until the round's first phiếu chấm. */
export function changeGradingMode(deps: CoreDeps) {
  return async (actor: Actor, input: { roundId: string; gradingMode: GradingMode }): Promise<void> => {
    authorize(actor, "round.manage");
    if (!GRADING_MODES.includes(input.gradingMode)) throw new DomainError("invalid_grading_mode", "Chế độ chấm không hợp lệ");
    return deps.uow.run(async (tx) => {
      const before = await lockConfigurable(deps, tx, input.roundId);
      if (before.gradingMode === input.gradingMode) return;
      const now = deps.clock.now();
      const after: Round = { ...before, gradingMode: input.gradingMode, updatedAt: now };
      await tx.rounds.update(after);
      const change = { from: before.gradingMode, to: after.gradingMode };
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "round.grading_mode_changed",
          targetType: "round",
          targetId: after.id,
          before: { gradingMode: change.from },
          after: { gradingMode: change.to },
          metadata: { status: after.status },
        }),
      );
      await emit(deps, tx, { type: "round.grading_mode_changed", payload: { roundId: after.id, ...change } });
    });
  };
}

/** L07 HD-06: Cán bộ Sở changes the Quy tắc tổng hợp until the round's first phiếu chấm, same lock as Chế độ chấm. */
export function changeAggregationRule(deps: CoreDeps) {
  return async (actor: Actor, input: { roundId: string; aggregation: AggregationRule }): Promise<void> => {
    authorize(actor, "round.manage");
    const aggregation = checkedAggregation(input.aggregation);
    return deps.uow.run(async (tx) => {
      const before = await lockConfigurable(deps, tx, input.roundId);
      if (sameAggregation(before.aggregation, aggregation)) return;
      const now = deps.clock.now();
      const after: Round = { ...before, aggregation, updatedAt: now };
      await tx.rounds.update(after);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "round.aggregation_changed",
          targetType: "round",
          targetId: after.id,
          before: { aggregation: before.aggregation },
          after: { aggregation: after.aggregation },
          metadata: { status: after.status },
        }),
      );
      await emit(deps, tx, { type: "round.aggregation_changed", payload: { roundId: after.id } });
    });
  };
}

/**
 * L07 SO-01: Cán bộ Sở ends a round Đã đóng nộp once every hồ sơ has a result (spec #16 stories 51-52).
 * Đã kết thúc is final. Thư ký hội đồng gets the same right in step 4 (L09).
 */
export function endRound(deps: CoreDeps) {
  return async (actor: Actor, input: { roundId: string }): Promise<void> => {
    authorize(actor, "round.manage");
    return deps.uow.run(async (tx) => {
      assertIdShape(input.roundId, roundNotFound);
      const before = await tx.rounds.lock(input.roundId);
      if (!before) throw roundNotFound();
      if (before.status !== "submission_closed") {
        throw new DomainError("round_not_closed", "Chỉ kết thúc được đợt ở trạng thái Đã đóng nộp");
      }
      const unfinished = await deps.roundActivity.unfinishedDossierCount(tx, before.id);
      if (unfinished > 0) {
        throw new DomainError("round_has_unfinished_dossiers", `Còn ${unfinished} hồ sơ chưa có kết quả, chưa kết thúc được đợt`);
      }
      const now = deps.clock.now();
      const after: Round = { ...before, status: "ended", endedAt: now, endedBy: actor.userId, updatedAt: now };
      await tx.rounds.update(after);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "round.ended",
          targetType: "round",
          targetId: after.id,
          before: { status: before.status },
          after: { status: after.status },
        }),
      );
      await emit(deps, tx, { type: "round.ended", payload: { roundId: after.id } });
    });
  };
}
