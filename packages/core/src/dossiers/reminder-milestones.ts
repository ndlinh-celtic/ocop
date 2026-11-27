import { DomainError } from "../shared/errors";
import { defineSetting } from "../system/settings";

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

/** Story 37: the mốc nhắc hạn in force, largest first, set by Quản trị for the whole system; the next run of the job uses them. */
export const REMINDER_MILESTONES = defineSetting<{ days: number[] }>({
  keys: { days: "reminder_milestones" },
  defaults: { days: [...DEFAULT_REMINDER_MILESTONES] },
  normalize: ({ days }) => ({ days: normalizeMilestones(days) }),
  auditAction: "system.reminder_milestones_changed",
});
