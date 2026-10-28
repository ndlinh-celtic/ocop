import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { emit } from "../platform/emit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import type { Tx } from "../shared/uow";
import { DEFAULT_UNDERPERFORMING_RATIO } from "../results/underperforming";

const REMINDER_MILESTONES = "reminder_milestones";

/** Story 37: mốc nhắc hạn, in days before a hạn, until Quản trị changes them. */
export const DEFAULT_REMINDER_MILESTONES: readonly number[] = [30, 14, 7, 1];
export const MAX_REMINDER_MILESTONES = 10;
export const MAX_REMINDER_DAYS = 365;

const invalidMilestones = () =>
  new DomainError(
    "invalid_reminder_milestones",
    `Mốc nhắc hạn là từ 1 đến ${MAX_REMINDER_MILESTONES} số ngày nguyên khác nhau, mỗi số từ 1 đến ${MAX_REMINDER_DAYS}`,
  );

/** Distinct whole days in 1..365, at most ten, largest first; refuses anything else. */
function normalizeMilestones(days: unknown): number[] {
  if (!Array.isArray(days) || days.length === 0 || days.length > MAX_REMINDER_MILESTONES) throw invalidMilestones();
  if (!days.every((d): d is number => Number.isInteger(d) && d >= 1 && d <= MAX_REMINDER_DAYS)) throw invalidMilestones();
  if (new Set(days).size !== days.length) throw invalidMilestones();
  return [...days].sort((a, b) => b - a);
}

/** The mốc nhắc hạn in force, largest first. */
export async function reminderMilestonesIn(tx: Tx): Promise<number[]> {
  const stored = await tx.systemSettings.get(REMINDER_MILESTONES);
  return stored === null || stored === undefined ? [...DEFAULT_REMINDER_MILESTONES] : normalizeMilestones(stored);
}

export function reminderMilestones(deps: CoreDeps) {
  return async (actor: Actor): Promise<{ days: number[] }> => {
    authorize(actor, "system.settings.manage");
    return deps.uow.run(async (tx) => ({ days: await reminderMilestonesIn(tx) }));
  };
}

/** Story 37: Quản trị sets the mốc nhắc hạn for the whole system; the next run of the job uses them. */
export function setReminderMilestones(deps: CoreDeps) {
  return async (actor: Actor, input: { days: unknown }): Promise<{ days: number[] }> => {
    authorize(actor, "system.settings.manage");
    const days = normalizeMilestones(input.days);
    return deps.uow.run(async (tx) => {
      const before = await reminderMilestonesIn(tx);
      const now = deps.clock.now();
      await tx.systemSettings.put(REMINDER_MILESTONES, days, now, actor.userId);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "system.reminder_milestones_changed",
          targetType: "system_setting",
          before: { days: before },
          after: { days },
        }),
      );
      await emit(deps, tx, { type: "system.setting_changed", payload: { key: REMINDER_MILESTONES } });
      return { days };
    });
  };
}

const UNDERPERFORMING_RATIO = "results.underperforming_ratio";

const invalidRatio = () =>
  new DomainError("invalid_underperforming_ratio", "Tỷ lệ Tiêu chí dưới mức là một số lớn hơn 0 và không quá 1 (ví dụ 0,5 là 50% điểm tối đa)");

/** A number in (0, 1]; refuses anything else. */
function normalizeRatio(ratio: unknown): number {
  if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio <= 0 || ratio > 1) throw invalidRatio();
  return ratio;
}

/** L16 (#80, story 37): the ratio of điểm tối đa below which a Tiêu chí is dưới mức, default 0,5. */
export async function underperformingRatioIn(tx: Tx): Promise<number> {
  const stored = await tx.systemSettings.get(UNDERPERFORMING_RATIO);
  return stored === null || stored === undefined ? DEFAULT_UNDERPERFORMING_RATIO : normalizeRatio(stored);
}

export function underperformingRatio(deps: CoreDeps) {
  return async (actor: Actor): Promise<{ ratio: number }> => {
    authorize(actor, "system.settings.manage");
    return deps.uow.run(async (tx) => ({ ratio: await underperformingRatioIn(tx) }));
  };
}

/** Story 35: Quản trị sets the Tiêu chí dưới mức ratio; views and Thư kết quả không đạt computed afterwards use it. */
export function setUnderperformingRatio(deps: CoreDeps) {
  return async (actor: Actor, input: { ratio: unknown }): Promise<{ ratio: number }> => {
    authorize(actor, "system.settings.manage");
    const ratio = normalizeRatio(input.ratio);
    return deps.uow.run(async (tx) => {
      const before = await underperformingRatioIn(tx);
      const now = deps.clock.now();
      await tx.systemSettings.put(UNDERPERFORMING_RATIO, ratio, now, actor.userId);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "system.underperforming_ratio_changed",
          targetType: "system_setting",
          before: { ratio: before },
          after: { ratio },
        }),
      );
      await emit(deps, tx, { type: "system.setting_changed", payload: { key: UNDERPERFORMING_RATIO } });
      return { ratio };
    });
  };
}
