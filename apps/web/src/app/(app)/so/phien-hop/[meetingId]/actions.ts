"use server";

import type { UploadInstructions } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const uploadInput = z.object({ fileName: z.string().min(1), contentType: z.string(), size: z.number().int().positive() });
const recordInput = z.object({
  fileId: z.string(),
  parts: z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string() })).optional(),
  number: z.string(),
  signedOn: z.string(),
});

/** L16 HD-11 (#83) step one: a pre-signed upload of the Quyết định công nhận đã ký (PDF). */
export async function requestDecisionUploadAction(
  input: z.infer<typeof uploadInput>,
): Promise<{ fileId: string; upload: UploadInstructions } | { error: string }> {
  const actor = await requireActor();
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { error: "Chọn tệp PDF đã ký" };
  try {
    return await app().core.files.requestUpload(actor, { ...parsed.data, purpose: "recognition_decision" });
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

/** Step two: the upload is complete; ghi nhận the quyết định of the Phiên họp, which Công bố kết quả of its hồ sơ. */
export async function recordDecisionAction(meetingId: string, input: z.infer<typeof recordInput>): Promise<{ error?: string }> {
  const actor = await requireActor();
  const parsed = recordInput.safeParse(input);
  if (!parsed.success) return { error: "Nội dung không hợp lệ" };
  const { fileId, parts, number, signedOn } = parsed.data;
  try {
    await app().core.files.completeUpload(actor, { fileId, parts });
    await app().core.results.recordMeetingDecision(actor, { meetingId, number, signedOn, fileId });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`/so/phien-hop/${meetingId}`);
  revalidatePath("/so/phien-hop");
  return {};
}

/** A short-lived link to the signed quyết định (the decision id passed as the DownloadButton's id). */
export async function downloadDecisionAction(decisionId: string): Promise<{ url?: string; error?: string }> {
  const actor = await requireActor();
  try {
    const { url } = await app().core.results.downloadDecision(actor, { decisionId });
    return { url };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}
