"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const recordInput = z.object({
  dossierIds: z.array(z.string()).min(1),
  fileId: z.string(),
  parts: z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string() })).optional(),
  number: z.string(),
  signedOn: z.string(),
});

/**
 * L17 (#88, story 57): the signed PDF is uploaded (requestDecisionUploadAction of the Phiên họp page, same purpose); ghi
 * nhận the Quyết định công nhận bổ sung of the hồ sơ chờ picked.
 */
export async function recordSupplementaryDecisionAction(input: z.infer<typeof recordInput>): Promise<{ error?: string }> {
  const actor = await requireActor();
  const parsed = recordInput.safeParse(input);
  if (!parsed.success) return { error: "Chọn hồ sơ và nhập đủ số, ngày ký" };
  const { fileId, parts, ...rest } = parsed.data;
  try {
    await app().core.files.completeUpload(actor, { fileId, parts });
    await app().core.results.recordSupplementaryDecision(actor, { ...rest, fileId });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/so/ho-so-5-sao", "layout");
  revalidatePath("/so/giay-chung-nhan");
  return {};
}
