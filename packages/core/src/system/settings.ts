import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { emit } from "../platform/emit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import type { Tx } from "../shared/uow";
import { DEFAULT_UNDERPERFORMING_RATIO } from "../results/underperforming";
import { DEFAULT_CERTIFICATE_CODE_SUFFIX, DEFAULT_CERTIFICATE_EXPIRY_REMINDER_MONTHS, DEFAULT_CERTIFICATE_VALIDITY_MONTHS } from "../results/certificate-model";

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

const CERTIFICATE_CODE_SUFFIX = "certificate.code_suffix";
const CERTIFICATE_VALIDITY_MONTHS = "certificate.validity_months";
const CERTIFICATE_EXPIRY_REMINDER_MONTHS = "certificate.expiry_reminder_months";
const MAX_SUFFIX = 30;
const MAX_MONTHS = 120;

/** L16 HD-11 (#84, story 35): the đuôi of a số hiệu, the months of hiệu lực, and the months before hết hiệu lực of the nhắc. */
export interface CertificateSettings {
  codeSuffix: string;
  validityMonths: number;
  expiryReminderMonths: number;
}

const invalidCertificateSettings = (message: string) => new DomainError("invalid_certificate_settings", message);

function normalizeSuffix(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > MAX_SUFFIX || /[\s/]/.test(text)) {
    throw invalidCertificateSettings(`Đuôi số hiệu có từ 1 đến ${MAX_SUFFIX} ký tự, không có khoảng trắng hay dấu /`);
  }
  return text;
}

function normalizeMonths(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_MONTHS) {
    throw invalidCertificateSettings(`${label} là số tháng nguyên từ 1 đến ${MAX_MONTHS}`);
  }
  return value;
}

function normalizeCertificateSettings(input: { codeSuffix: unknown; validityMonths: unknown; expiryReminderMonths: unknown }): CertificateSettings {
  const codeSuffix = normalizeSuffix(input.codeSuffix);
  const validityMonths = normalizeMonths(input.validityMonths, "Thời hạn hiệu lực");
  const expiryReminderMonths = normalizeMonths(input.expiryReminderMonths, "Số tháng nhắc trước");
  if (expiryReminderMonths >= validityMonths) throw invalidCertificateSettings("Số tháng nhắc trước phải nhỏ hơn thời hạn hiệu lực");
  return { codeSuffix, validityMonths, expiryReminderMonths };
}

/** The settings of Giấy chứng nhận in force; a key never set reads as its default. */
export async function certificateSettingsIn(tx: Tx): Promise<CertificateSettings> {
  const or = (stored: unknown, fallback: unknown) => (stored === null || stored === undefined ? fallback : stored);
  return normalizeCertificateSettings({
    codeSuffix: or(await tx.systemSettings.get(CERTIFICATE_CODE_SUFFIX), DEFAULT_CERTIFICATE_CODE_SUFFIX),
    validityMonths: or(await tx.systemSettings.get(CERTIFICATE_VALIDITY_MONTHS), DEFAULT_CERTIFICATE_VALIDITY_MONTHS),
    expiryReminderMonths: or(await tx.systemSettings.get(CERTIFICATE_EXPIRY_REMINDER_MONTHS), DEFAULT_CERTIFICATE_EXPIRY_REMINDER_MONTHS),
  });
}

export function certificateSettings(deps: CoreDeps) {
  return async (actor: Actor): Promise<CertificateSettings> => {
    authorize(actor, "system.settings.manage");
    return deps.uow.run((tx) => certificateSettingsIn(tx));
  };
}

/**
 * Story 35: Quản trị sets them for the whole system. A Giấy chứng nhận issued afterwards uses them; one already issued
 * keeps its số hiệu, and its ngày hết hiệu lực changes only with a correction of its quyết định.
 */
export function setCertificateSettings(deps: CoreDeps) {
  return async (actor: Actor, input: { codeSuffix: unknown; validityMonths: unknown; expiryReminderMonths: unknown }): Promise<CertificateSettings> => {
    authorize(actor, "system.settings.manage");
    const after = normalizeCertificateSettings(input);
    return deps.uow.run(async (tx) => {
      const before = await certificateSettingsIn(tx);
      const now = deps.clock.now();
      const keys = [
        [CERTIFICATE_CODE_SUFFIX, after.codeSuffix],
        [CERTIFICATE_VALIDITY_MONTHS, after.validityMonths],
        [CERTIFICATE_EXPIRY_REMINDER_MONTHS, after.expiryReminderMonths],
      ] as const;
      for (const [key, value] of keys) await tx.systemSettings.put(key, value, now, actor.userId);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "system.certificate_settings_changed",
          targetType: "system_setting",
          before,
          after,
        }),
      );
      for (const [key] of keys) await emit(deps, tx, { type: "system.setting_changed", payload: { key } });
      return after;
    });
  };
}
