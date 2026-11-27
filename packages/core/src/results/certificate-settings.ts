import { DomainError } from "../shared/errors";
import { defineSetting } from "../system/settings";
import { DEFAULT_CERTIFICATE_CODE_SUFFIX, DEFAULT_CERTIFICATE_EXPIRY_REMINDER_MONTHS, DEFAULT_CERTIFICATE_VALIDITY_MONTHS } from "./certificate-model";

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

/**
 * Story 35: the settings of Giấy chứng nhận, set by Quản trị for the whole system. A Giấy chứng nhận issued afterwards uses
 * them; one already issued keeps its số hiệu, and its ngày hết hiệu lực changes only with a correction of its quyết định.
 */
export const CERTIFICATE_SETTINGS = defineSetting<CertificateSettings>({
  keys: { codeSuffix: "certificate.code_suffix", validityMonths: "certificate.validity_months", expiryReminderMonths: "certificate.expiry_reminder_months" },
  defaults: {
    codeSuffix: DEFAULT_CERTIFICATE_CODE_SUFFIX,
    validityMonths: DEFAULT_CERTIFICATE_VALIDITY_MONTHS,
    expiryReminderMonths: DEFAULT_CERTIFICATE_EXPIRY_REMINDER_MONTHS,
  },
  normalize: (input) => {
    const codeSuffix = normalizeSuffix(input.codeSuffix);
    const validityMonths = normalizeMonths(input.validityMonths, "Thời hạn hiệu lực");
    const expiryReminderMonths = normalizeMonths(input.expiryReminderMonths, "Số tháng nhắc trước");
    if (expiryReminderMonths >= validityMonths) throw invalidCertificateSettings("Số tháng nhắc trước phải nhỏ hơn thời hạn hiệu lực");
    return { codeSuffix, validityMonths, expiryReminderMonths };
  },
  auditAction: "system.certificate_settings_changed",
});
