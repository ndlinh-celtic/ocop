import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { emit } from "../platform/emit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import type { Tx } from "../shared/uow";
import { closeDueActorFor, closeDueInTx } from "./close-due";
import {
  AGGREGATION_METHODS,
  assertDeadlineOrder,
  assertDraftRound,
  endOfVnDay,
  GRADING_MODES,
  isPastSubmissionDeadline,
  roundAlreadyOpen,
  type AggregationRule,
  type GradingMode,
  type Round,
} from "./model";

/** What Cán bộ Sở fills in to create or edit a Nháp round. Deadlines are calendar dates in Vietnam. */
export interface RoundInput {
  name: string;
  year: number;
  submissionDeadline: string;
  forwardingDeadline: string;
  evaluationDeadline: string;
  criteriaVersionId: string;
  gradingMode: GradingMode;
  aggregation: AggregationRule;
}

export const roundNotFound = () => new DomainError("not_found", "Không tìm thấy đợt đánh giá");

/** A Quy tắc tổng hợp with only the known fields, or a DomainError `invalid_aggregation`. */
export function checkedAggregation({ method, minGraders, deviationFlagPoints }: AggregationRule): AggregationRule {
  if (!AGGREGATION_METHODS.includes(method)) throw new DomainError("invalid_aggregation", "Cách tổng hợp không hợp lệ");
  if (!Number.isInteger(minGraders) || minGraders < 1 || minGraders > 50) {
    throw new DomainError("invalid_aggregation", "Số người chấm tối thiểu phải là số nguyên từ 1 đến 50");
  }
  if (!Number.isFinite(deviationFlagPoints) || deviationFlagPoints < 0) {
    throw new DomainError("invalid_aggregation", "Ngưỡng cờ chênh lệch phải là số điểm không âm");
  }
  return { method, minGraders, deviationFlagPoints };
}

/** The checked fields of a Nháp round, or a DomainError naming the first rule broken. */
async function checkedFields(tx: Tx, input: RoundInput) {
  const name = input.name.trim();
  if (!name) throw new DomainError("name_required", "Nhập tên đợt đánh giá");
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) throw new DomainError("invalid_year", "Năm không hợp lệ");
  const deadlines = {
    submissionDeadline: endOfVnDay(input.submissionDeadline),
    forwardingDeadline: endOfVnDay(input.forwardingDeadline),
    evaluationDeadline: endOfVnDay(input.evaluationDeadline),
  };
  assertDeadlineOrder(deadlines);
  if (!GRADING_MODES.includes(input.gradingMode)) throw new DomainError("invalid_grading_mode", "Chế độ chấm không hợp lệ");
  const aggregation = checkedAggregation(input.aggregation);
  const version = await tx.criteriaVersions.findById(input.criteriaVersionId);
  if (!version || version.status !== "published") {
    throw new DomainError("version_not_published", "Chọn một Phiên bản tiêu chí đã phát hành");
  }
  return {
    name,
    year: input.year,
    ...deadlines,
    criteriaVersionId: version.id,
    gradingMode: input.gradingMode,
    aggregation,
  };
}

/** What the audit log keeps of a round: its configuration, no personal data. */
export const describeRound = (r: Round) => ({
  name: r.name,
  year: r.year,
  status: r.status,
  criteriaVersionId: r.criteriaVersionId,
  submissionDeadline: r.submissionDeadline.toISOString(),
  forwardingDeadline: r.forwardingDeadline.toISOString(),
  evaluationDeadline: r.evaluationDeadline.toISOString(),
  gradingMode: r.gradingMode,
  aggregation: r.aggregation,
});

/** L07 SO-01: Cán bộ Sở creates a Đợt đánh giá in Nháp. */
export function createRound(deps: CoreDeps) {
  return async (actor: Actor, input: RoundInput): Promise<{ roundId: string }> => {
    authorize(actor, "round.manage");
    return deps.uow.run(async (tx) => {
      const fields = await checkedFields(tx, input);
      const now = deps.clock.now();
      const round: Round = {
        id: deps.ids.next(),
        ...fields,
        status: "draft",
        createdAt: now,
        createdBy: actor.userId,
        updatedAt: now,
        openedAt: null,
        openedBy: null,
        submissionClosedAt: null,
        endedAt: null,
        endedBy: null,
      };
      await tx.rounds.insert(round);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, { action: "round.created", targetType: "round", targetId: round.id, after: describeRound(round) }),
      );
      await emit(deps, tx, { type: "round.created", payload: { roundId: round.id } });
      return { roundId: round.id };
    });
  };
}

/** L07 SO-01: a Nháp round may be edited freely, Phiên bản tiêu chí included. */
export function updateRound(deps: CoreDeps) {
  return async (actor: Actor, input: RoundInput & { roundId: string }): Promise<void> => {
    authorize(actor, "round.manage");
    return deps.uow.run(async (tx) => {
      const before = await tx.rounds.lock(input.roundId);
      if (!before) throw roundNotFound();
      assertDraftRound(before);
      const now = deps.clock.now();
      const after: Round = { ...before, ...(await checkedFields(tx, input)), updatedAt: now };
      await tx.rounds.update(after);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "round.updated",
          targetType: "round",
          targetId: after.id,
          before: describeRound(before),
          after: describeRound(after),
        }),
      );
      await emit(deps, tx, { type: "round.updated", payload: { roundId: after.id } });
    });
  };
}

/** L07 SO-01: a round created by mistake is deleted while still Nháp. */
export function deleteRound(deps: CoreDeps) {
  return async (actor: Actor, input: { roundId: string }): Promise<void> => {
    authorize(actor, "round.manage");
    return deps.uow.run(async (tx) => {
      const round = await tx.rounds.lock(input.roundId);
      if (!round) throw roundNotFound();
      assertDraftRound(round);
      const now = deps.clock.now();
      await tx.rounds.delete(round.id);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, { action: "round.deleted", targetType: "round", targetId: round.id, before: describeRound(round) }),
      );
      await emit(deps, tx, { type: "round.deleted", payload: { roundId: round.id } });
    });
  };
}

/**
 * L07 SO-01: Cán bộ Sở opens a Nháp round (Đang nhận nộp). Refused while another round is open, so a
 * Chủ thể never has to choose one, and once Hạn nộp xã has passed. From here the Phiên bản tiêu chí is fixed.
 */
export function openRound(deps: CoreDeps) {
  return async (actor: Actor, input: { roundId: string }): Promise<void> => {
    authorize(actor, "round.manage");
    return deps.uow.run(async (tx) => {
      const before = await tx.rounds.lock(input.roundId);
      if (!before) throw roundNotFound();
      if (before.status !== "draft") throw new DomainError("round_not_draft", "Chỉ mở được đợt đang ở trạng thái Nháp");
      const now = deps.clock.now();
      if (isPastSubmissionDeadline(before, now)) {
        throw new DomainError("deadline_passed", "Hạn nộp xã đã qua, không mở được đợt. Hãy sửa Hạn nộp xã trước khi mở.");
      }
      // A round past its Hạn nộp xã that the job has not closed yet must not block this one.
      await closeDueInTx(deps, tx, closeDueActorFor(actor), now);
      const open = await tx.rounds.findOpen();
      if (open) throw roundAlreadyOpen(open.name);
      const after: Round = { ...before, status: "open_for_submission", openedAt: now, openedBy: actor.userId, updatedAt: now };
      await tx.rounds.update(after);
      const opened = { criteriaVersionId: after.criteriaVersionId, submissionDeadline: after.submissionDeadline.toISOString() };
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "round.opened",
          targetType: "round",
          targetId: after.id,
          before: { status: before.status },
          after: { status: after.status, ...opened },
        }),
      );
      await emit(deps, tx, { type: "round.opened", payload: { roundId: after.id, ...opened } });
    });
  };
}
