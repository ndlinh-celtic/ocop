import { authorize, can } from "../identity/policy";
import type { Round } from "../rounds/model";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape, isUuid } from "../shared/ids";
import { dataScopeOf } from "../identity/scope";
import { lockDossier } from "./edit";
import { dossierNotFound, type Dossier } from "./model";
import { transition } from "./transition";

/*
 * L06 XA-08 (stories 68 to 70): a hồ sơ Đã nộp xã whose đợt can no longer take it (Chờ đợt sau) is moved
 * into a later đợt by the xã. Chuyển đợt does not move the hồ sơ: it keeps its state, Tiếp nhận, Cán bộ
 * phụ trách and Phiên bản nộp, and only its đợt changes.
 */

const MAX_REASON = 2_000;

/**
 * Why `round` cannot take `dossier` at `now`, or null when it can: the đợt must apply the Phiên bản tiêu
 * chí the hồ sơ is fixed to (ADR 0006), be past Nháp (before that its Phiên bản may still change), not be
 * Đã kết thúc, and still be within its Hạn gửi tỉnh.
 */
function refusalOf(dossier: Dossier, round: Round, now: Date): DomainError | null {
  if (round.id === dossier.roundId) return new DomainError("same_round", "Hồ sơ đang thuộc đợt này");
  if (round.criteriaVersionId !== dossier.criteriaVersionId) {
    return new DomainError("round_criteria_version_mismatch", "Đợt đích dùng Phiên bản tiêu chí khác với hồ sơ nên không chuyển được");
  }
  if (round.status === "draft") return new DomainError("round_not_open", "Đợt đích chưa mở nên chưa nhận chuyển hồ sơ");
  if (round.status === "ended") return new DomainError("round_ended", "Đợt đích đã kết thúc nên không nhận chuyển hồ sơ");
  if (now > round.forwardingDeadline) return new DomainError("round_forwarding_deadline_passed", "Đợt đích đã quá Hạn gửi tỉnh nên không nhận chuyển hồ sơ");
  return null;
}

/** L06 XA-08 (stories 69, 70): moves a hồ sơ Đã nộp xã into another đợt, with a lý do; the Chủ thể is told. */
export function transferRound(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number; roundId: string; reason: string }): Promise<{ version: number }> => {
    authorize(actor, "dossier.write");
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (reason === "") throw new DomainError("reason_required", "Nhập lý do chuyển đợt");
    if (reason.length > MAX_REASON) throw new DomainError("field_too_long", "Nội dung quá dài");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const round = isUuid(input.roundId) ? await tx.rounds.findById(input.roundId) : null;
      if (!round) throw new DomainError("invalid_round", "Không tìm thấy đợt đánh giá nhận hồ sơ");
      const now = deps.clock.now();
      // transition() first, so that a wrong state, Vai trò or version is reported as such; a refused đợt
      // then throws and the transaction rolls the transition back.
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.round_transfer",
        expectedVersion: input.expectedVersion,
        patch: { roundId: round.id },
        reason,
        metadata: { fromRoundId: before.roundId, toRoundId: round.id },
      });
      const refusal = refusalOf(before, round, now);
      if (refusal) throw refusal;
      return { version: after.version };
    });
  };
}

/** The đợt the reader could move a hồ sơ to now, newest first (for the chuyển đợt form); none when it may not. */
export function roundTransferTargets(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<{ id: string; name: string; forwardingDeadline: Date }[]> => {
    authorize(actor, "dossier.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      if (!can(actor, "dossier.round_transfer", dossier)) return [];
      const now = deps.clock.now();
      return (await tx.rounds.list())
        .filter((r) => refusalOf(dossier, r, now) === null)
        .map((r) => ({ id: r.id, name: r.name, forwardingDeadline: r.forwardingDeadline }));
    });
  };
}
