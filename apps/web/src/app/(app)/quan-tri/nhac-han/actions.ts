"use server";

import { revalidatePath } from "next/cache";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export interface MilestonesFormState {
  error?: string;
  saved?: boolean;
}

/** "30, 14, 7, 1" → [30, 14, 7, 1]; anything not a number stays NaN for the use case to refuse. */
const parseDays = (raw: FormDataEntryValue | null) =>
  String(raw ?? "")
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number);

/** Story 37: Quản trị sets the mốc nhắc hạn for the whole system. */
export async function setMilestonesAction(_prev: MilestonesFormState, form: FormData): Promise<MilestonesFormState> {
  const actor = await requireActor();
  try {
    await app().core.system.setReminderMilestones(actor, { days: parseDays(form.get("days")) });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/quan-tri/nhac-han");
  return { saved: true };
}
