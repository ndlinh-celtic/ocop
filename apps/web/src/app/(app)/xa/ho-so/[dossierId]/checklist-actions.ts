"use server";

import { CHECKLIST_RESULTS, type ChecklistResultInput } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export interface ChecklistFormState {
  error?: string;
  saved?: boolean;
}

const result = z.enum(CHECKLIST_RESULTS);

/**
 * L06 XA-04 (story 61): saves the Checklist sơ bộ of a hồ sơ. The form sends every item's code, its
 * result as `result.<code>` and its nhận xét as `comment.<code>`; items left without a result are not sent.
 */
export async function assessChecklistAction(dossierId: string, expectedVersion: number, _prev: ChecklistFormState, form: FormData): Promise<ChecklistFormState> {
  const actor = await requireActor();
  const results: ChecklistResultInput[] = [];
  for (const code of form.getAll("itemCode")) {
    if (typeof code !== "string") continue;
    const parsed = result.safeParse(form.get(`result.${code}`));
    if (!parsed.success) continue;
    const comment = form.get(`comment.${code}`);
    results.push({ itemCode: code, result: parsed.data, comment: typeof comment === "string" ? comment : "" });
  }
  if (results.length === 0) return { error: "Chọn kết quả cho ít nhất một mục" };
  try {
    await app().core.dossiers.assessChecklist(actor, { dossierId, expectedVersion, results });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`/xa/ho-so/${dossierId}`);
  return { saved: true };
}
