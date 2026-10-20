"use server";

import { revalidatePath } from "next/cache";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export interface ReturnRequestFormState {
  error?: string;
  saved?: boolean;
}

/** L04 (story 59): the xã sends the Sở a đề nghị trả về of a hồ sơ it has gửi tỉnh, with a lý do. */
export async function requestReturnAction(dossierId: string, expectedVersion: number, _prev: ReturnRequestFormState, form: FormData): Promise<ReturnRequestFormState> {
  const actor = await requireActor();
  const reason = String(form.get("reason") ?? "").trim();
  if (!reason) return { error: "Nhập lý do đề nghị trả về" };
  try {
    await app().core.dossiers.requestReturn(actor, { dossierId, expectedVersion, reason });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`/xa/ho-so/${dossierId}`);
  revalidatePath(`/so/ho-so/${dossierId}`);
  return { saved: true };
}
