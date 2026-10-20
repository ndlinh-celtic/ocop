"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";
import type { WardDossierFormState } from "./actions";

const LIST = "/xa/ho-so";

const transferInput = z.object({ roundId: z.string().trim().min(1), reason: z.string().trim().min(1).max(2000) });

/** L06 XA-08 (story 69): chuyển đợt; the hồ sơ stays at this xã, in another đợt. */
export async function transferRoundAction(dossierId: string, expectedVersion: number, _prev: WardDossierFormState, form: FormData): Promise<WardDossierFormState> {
  const actor = await requireActor();
  const parsed = transferInput.safeParse({ roundId: form.get("roundId") ?? "", reason: form.get("reason") ?? "" });
  if (!parsed.success) return { error: "Chọn đợt nhận hồ sơ và nhập lý do chuyển" };
  try {
    await app().core.dossiers.transferRound(actor, { dossierId, expectedVersion, ...parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${dossierId}`);
  return { saved: true };
}
