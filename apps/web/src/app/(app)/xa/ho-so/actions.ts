"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const LIST = "/xa/ho-so";

export interface WardDossierFormState {
  error?: string;
  saved?: boolean;
}

const handlerInput = z.object({ handlerUserId: z.string().trim().min(1) });

/** L05 XA-02 (story 40): Tiếp nhận, naming the Cán bộ phụ trách (the officer themself by default). */
export async function receiveDossierAction(dossierId: string, expectedVersion: number, _prev: WardDossierFormState, form: FormData): Promise<WardDossierFormState> {
  const actor = await requireActor();
  const parsed = handlerInput.safeParse({ handlerUserId: form.get("handlerUserId") ?? "" });
  try {
    await app().core.dossiers.receive(actor, { dossierId, expectedVersion, handlerUserId: parsed.success ? parsed.data.handlerUserId : null });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${dossierId}`);
  return { saved: true };
}

/** L05 XA-03 (story 41): another Cán bộ phụ trách for a received hồ sơ. */
export async function changeHandlerAction(dossierId: string, expectedVersion: number, _prev: WardDossierFormState, form: FormData): Promise<WardDossierFormState> {
  const actor = await requireActor();
  const parsed = handlerInput.safeParse({ handlerUserId: form.get("handlerUserId") ?? "" });
  if (!parsed.success) return { error: "Chọn Cán bộ phụ trách" };
  try {
    await app().core.dossiers.changeHandler(actor, { dossierId, expectedVersion, handlerUserId: parsed.data.handlerUserId });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${dossierId}`);
  return { saved: true };
}
