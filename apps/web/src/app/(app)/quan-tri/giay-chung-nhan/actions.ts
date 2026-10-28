"use server";

import { revalidatePath } from "next/cache";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export interface CertificateSettingsState {
  error?: string;
  saved?: boolean;
}

/** L16 HD-11 (#84, story 35): Quản trị sets the đuôi số hiệu, the months of hiệu lực and of nhắc trước. */
export async function setCertificateSettingsAction(_prev: CertificateSettingsState, form: FormData): Promise<CertificateSettingsState> {
  const actor = await requireActor();
  const months = (name: string) => Number(String(form.get(name) ?? "").trim() || Number.NaN);
  try {
    await app().core.system.setCertificateSettings(actor, {
      codeSuffix: String(form.get("codeSuffix") ?? ""),
      validityMonths: months("validityMonths"),
      expiryReminderMonths: months("expiryReminderMonths"),
    });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/quan-tri/giay-chung-nhan");
  return { saved: true };
}
