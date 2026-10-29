"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const PAGE = "/quan-tri/giay-chung-nhan";

export interface CertificateSettingsState {
  error?: string;
  saved?: boolean;
}

const months = z.coerce.number().int();
const certificateSettingsInput = z.object({
  codeSuffix: z.string(),
  validityMonths: months,
  expiryReminderMonths: months,
});

/** L16 HD-11 (#84, story 35): Quản trị sets the đuôi số hiệu, the months of hiệu lực and of nhắc trước. */
export async function setCertificateSettingsAction(_prev: CertificateSettingsState, form: FormData): Promise<CertificateSettingsState> {
  const actor = await requireActor();
  const parsed = certificateSettingsInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Nhập đuôi số hiệu và số tháng là số nguyên" };
  try {
    await app().core.system.setCertificateSettings(actor, parsed.data);
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(PAGE);
  return { saved: true };
}

/** "50" or "50,5" (%) → 0.5 / 0.505; the use case refuses a ratio outside (0, 1]. */
const ratioInput = z.object({
  percent: z
    .string()
    .trim()
    .min(1)
    .transform((s) => Number(s.replace(",", ".")))
    .pipe(z.number().finite()),
});

/** Story 35 (#79 review): Quản trị sets the tỷ lệ Tiêu chí dưới mức, as a % of điểm tối đa. */
export async function setUnderperformingRatioAction(_prev: CertificateSettingsState, form: FormData): Promise<CertificateSettingsState> {
  const actor = await requireActor();
  const parsed = ratioInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Nhập tỷ lệ là một số, ví dụ 50" };
  try {
    await app().core.system.setUnderperformingRatio(actor, { ratio: parsed.data.percent / 100 });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(PAGE);
  return { saved: true };
}
