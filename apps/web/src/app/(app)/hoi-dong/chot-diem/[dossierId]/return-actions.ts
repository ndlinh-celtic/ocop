"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export interface ReturnSheetFormState {
  error?: string;
  saved?: boolean;
}

const reason = z.string().trim().min(1).max(2_000);

/** L15 HD-05 (stories 102 to 105): Trả phiếu of one thành viên chấm, with a lý do, before chốt. */
export async function returnScoreSheetAction(dossierId: string, sheetId: string, _prev: ReturnSheetFormState, form: FormData): Promise<ReturnSheetFormState> {
  const actor = await requireActor();
  const parsed = reason.safeParse(form.get("reason") ?? "");
  if (!parsed.success) return { error: "Nhập lý do Trả phiếu (tối đa 2.000 ký tự)" };
  try {
    await app().core.scoring.returnScoreSheet(actor, { dossierId, sheetId, reason: parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`/hoi-dong/chot-diem/${dossierId}`);
  revalidatePath("/hoi-dong/chot-diem");
  revalidatePath("/hoi-dong/tien-do");
  return { saved: true };
}
