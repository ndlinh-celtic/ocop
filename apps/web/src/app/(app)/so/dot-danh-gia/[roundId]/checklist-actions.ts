"use server";

import type { ChecklistItemInput } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";
import type { RoundFormState } from "../actions";

/**
 * L06 XA-04 (story 60): saves the Checklist sơ bộ of a Nháp round. The form sends the items in order as
 * parallel `code` (blank for a new item) and `label` fields.
 */
export async function configureChecklistAction(roundId: string, _prev: RoundFormState, form: FormData): Promise<RoundFormState> {
  const actor = await requireActor();
  const codes = form.getAll("code");
  const items: ChecklistItemInput[] = form.getAll("label").map((label, n) => {
    const code = codes[n];
    return { code: typeof code === "string" && code ? code : null, label: typeof label === "string" ? label : "" };
  });
  try {
    await app().core.rounds.configureChecklist(actor, { roundId, items });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`/so/dot-danh-gia/${roundId}`);
  return { saved: true };
}
