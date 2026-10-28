"use server";

import { DomainError, MAX_ADVICE, MAX_CORRECTION_REASON } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const letterInput = z.object({
  dossierId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
  criterionIds: z.array(z.string()),
  advice: z.string().max(MAX_ADVICE),
  reason: z.string().max(MAX_CORRECTION_REASON).optional(),
});

export type LetterActionInput = z.infer<typeof letterInput>;

/** L16 HD-10 (#85, stories 40, 43): phát hành the Thư kết quả không đạt, or a thư đính chính after it. */
export async function issueResultLetterAction(input: LetterActionInput): Promise<{ error?: string; conflict?: boolean }> {
  const actor = await requireActor();
  const parsed = letterInput.safeParse(input);
  if (!parsed.success) return { error: "Nội dung thư không hợp lệ hoặc quá dài" };
  try {
    await app().core.results.issueResultLetter(actor, parsed.data);
  } catch (err) {
    return { error: domainMessage(err), conflict: err instanceof DomainError && err.code === "version_conflict" };
  }
  revalidatePath(`/so/ho-so/${parsed.data.dossierId}`);
  revalidatePath(`/so/ho-so/${parsed.data.dossierId}/thu-ket-qua`);
  return {};
}

/** A short-lived link to one phiên bản of the letter; the DownloadButton passes "<dossierId>:<letterId>". */
export async function downloadLetterAction(ref: string): Promise<{ url?: string; error?: string }> {
  const actor = await requireActor();
  const [dossierId, letterId] = ref.split(":");
  try {
    return { url: (await app().core.results.downloadResultLetter(actor, { dossierId: dossierId ?? "", letterId })).url };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}
