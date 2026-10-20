import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { emit } from "../platform/emit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { roundNotFound } from "./manage";
import { roundVisibleTo } from "./read";
import {
  assertDeadlineOrder,
  endOfVnDay,
  EXTENDABLE_DEADLINE_LABEL,
  EXTENDABLE_DEADLINES,
  isPastSubmissionDeadline,
  type DeadlineExtension,
  type DeadlineExtensionView,
  type ExtendableDeadline,
  type Round,
} from "./model";

export interface ExtendDeadlineInput {
  roundId: string;
  deadline: ExtendableDeadline;
  /** The new deadline as a calendar date in Vietnam (end of that day). */
  newDate: string;
  reason: string;
}

const REASON_MAX = 2000;
const FIELD = { submission: "submissionDeadline", forwarding: "forwardingDeadline", evaluation: "evaluationDeadline" } as const;

/**
 * L07 Gia hạn đợt (#26): Cán bộ Sở moves Hạn nộp xã, Hạn gửi tỉnh or Hạn đánh giá tỉnh later, with a reason. Only an opened
 * round that has not ended (a Nháp round is edited directly). Never shortens, and the three deadlines stay
 * in order. Hạn nộp xã can only be extended while submission is still open (Đang nhận nộp and not yet past
 * it), to a day in the future; once Đã đóng nộp a round never goes back to Đang nhận nộp (review of #29).
 */
export function extendDeadline(deps: CoreDeps) {
  return async (actor: Actor, input: ExtendDeadlineInput): Promise<{ extensionId: string }> => {
    authorize(actor, "round.manage");
    if (!EXTENDABLE_DEADLINES.includes(input.deadline)) {
      throw new DomainError("invalid_deadline", "Chỉ gia hạn được Hạn nộp xã, Hạn gửi tỉnh hoặc Hạn đánh giá tỉnh");
    }
    const reason = input.reason.trim();
    if (!reason) throw new DomainError("reason_required", "Nhập lý do gia hạn");
    if (reason.length > REASON_MAX) throw new DomainError("reason_too_long", `Lý do gia hạn tối đa ${REASON_MAX} ký tự`);
    const newDeadline = endOfVnDay(input.newDate);
    const label = EXTENDABLE_DEADLINE_LABEL[input.deadline];
    const field = FIELD[input.deadline];

    return deps.uow.run(async (tx) => {
      const before = await tx.rounds.lock(input.roundId);
      if (!before) throw roundNotFound();
      if (before.status === "draft") throw new DomainError("round_is_draft", "Đợt đang ở trạng thái Nháp: sửa trực tiếp các mốc hạn, không cần gia hạn");
      if (before.status === "ended") throw new DomainError("round_ended", "Đợt đã kết thúc, không gia hạn được");
      const now = deps.clock.now();
      if (input.deadline === "submission" && (before.status !== "open_for_submission" || isPastSubmissionDeadline(before, now))) {
        throw new DomainError("submission_closed", "Đợt đã đóng nộp: không gia hạn Hạn nộp xã được nữa và đợt không mở lại");
      }
      const previousDeadline = before[field];
      if (newDeadline <= previousDeadline) throw new DomainError("deadline_not_later", `${label} mới phải sau ${label} hiện tại; không rút ngắn hạn`);
      const after: Round = { ...before, [field]: newDeadline, updatedAt: now };
      assertDeadlineOrder(after);
      await tx.rounds.update(after);

      const extension: DeadlineExtension = {
        id: deps.ids.next(),
        roundId: before.id,
        deadline: input.deadline,
        previousDeadline,
        newDeadline,
        reason,
        extendedBy: actor.userId,
        extendedAt: now,
      };
      await tx.rounds.insertExtension(extension);

      const previousIso = previousDeadline.toISOString();
      const newIso = newDeadline.toISOString();
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "round.deadline_extended",
          targetType: "round",
          targetId: before.id,
          before: { [field]: previousIso },
          after: { [field]: newIso },
          metadata: { extensionId: extension.id, deadline: input.deadline, reason },
        }),
      );
      await emit(deps, tx, {
        type: "round.deadline_extended",
        payload: { roundId: before.id, extensionId: extension.id, deadline: input.deadline, previousDeadline: previousIso, newDeadline: newIso },
      });
      return { extensionId: extension.id };
    });
  };
}

/** L07: the Gia hạn đợt history of a round, newest first; every signed-in Người dùng may read it. */
export function listDeadlineExtensions(deps: CoreDeps) {
  return async (actor: Actor, input: { roundId: string }): Promise<DeadlineExtensionView[]> => {
    authorize(actor, "round.read");
    return deps.uow.run(async (tx) => {
      const round = await tx.rounds.findById(input.roundId);
      if (!round || !roundVisibleTo(actor, round)) throw roundNotFound();
      return tx.rounds.listExtensions(input.roundId);
    });
  };
}
