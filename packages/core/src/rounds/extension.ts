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
  roundAlreadyOpen,
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
const FIELD = { submission: "submissionDeadline", forwarding: "forwardingDeadline" } as const;

/**
 * L07 Gia hạn đợt (#26): Cán bộ Sở moves Hạn nộp xã or Hạn gửi tỉnh later, with a reason. Only an opened
 * round that has not ended (a Nháp round is edited directly). Never shortens, and the three deadlines stay
 * in order. Extending Hạn nộp xã of a Đã đóng nộp round brings it back to Đang nhận nộp, unless another
 * round is open; the new Hạn nộp xã must then lie in the future, or the auto-close job would close it again.
 */
export function extendDeadline(deps: CoreDeps) {
  return async (actor: Actor, input: ExtendDeadlineInput): Promise<{ extensionId: string; reopened: boolean }> => {
    authorize(actor, "round.manage");
    if (!EXTENDABLE_DEADLINES.includes(input.deadline)) {
      throw new DomainError("invalid_deadline", "Chỉ gia hạn được Hạn nộp xã hoặc Hạn gửi tỉnh");
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
      const previousDeadline = before[field];
      if (newDeadline <= previousDeadline) throw new DomainError("deadline_not_later", `${label} mới phải sau ${label} hiện tại; không rút ngắn hạn`);
      const now = deps.clock.now();
      const after: Round = { ...before, [field]: newDeadline, updatedAt: now };
      assertDeadlineOrder(after);

      const reopened = input.deadline === "submission" && before.status === "submission_closed";
      if (input.deadline === "submission" && isPastSubmissionDeadline(after, now)) {
        throw new DomainError("deadline_passed", "Hạn nộp xã mới đã qua; chọn một ngày từ hôm nay trở đi");
      }
      if (reopened) {
        const open = await tx.rounds.findOpen();
        if (open) throw roundAlreadyOpen(open.name);
        after.status = "open_for_submission";
      }
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
        reopened,
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
          metadata: { extensionId: extension.id, deadline: input.deadline, reason, reopened },
        }),
      );
      await emit(deps, tx, {
        type: "round.deadline_extended",
        payload: { roundId: before.id, extensionId: extension.id, deadline: input.deadline, previousDeadline: previousIso, newDeadline: newIso },
      });
      if (reopened) {
        await tx.audit.append(
          auditEntry(actor, deps.ids.next(), now, {
            action: "round.reopened",
            targetType: "round",
            targetId: before.id,
            before: { status: before.status },
            after: { status: after.status, submissionDeadline: newIso },
            metadata: { extensionId: extension.id },
          }),
        );
        await emit(deps, tx, { type: "round.reopened", payload: { roundId: before.id, extensionId: extension.id, submissionDeadline: newIso } });
      }
      return { extensionId: extension.id, reopened };
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
