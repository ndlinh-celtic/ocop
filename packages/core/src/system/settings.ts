import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { emit } from "../platform/emit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import type { Tx } from "../shared/uow";

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
