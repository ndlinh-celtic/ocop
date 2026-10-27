"use server";

import type { UploadInstructions } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const uploadInput = z.object({ fileName: z.string().min(1), contentType: z.string(), size: z.number().int().positive() });
const parts = z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string() })).optional();

/** L15 HD-09 (story 115) step one: a pre-signed upload of the biên bản đã ký số (PDF). */
export async function requestMinutesUploadAction(
  input: z.infer<typeof uploadInput>,
): Promise<{ fileId: string; upload: UploadInstructions } | { error: string }> {
  const actor = await requireActor();
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { error: "Chọn tệp PDF đã ký" };
  try {
    return await app().core.files.requestUpload(actor, { ...parsed.data, purpose: "meeting_minutes" });
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

/** Step two: the upload is complete and the PDF becomes the next biên bản of the Phiên họp; the scan runs after. */
export async function attachMinutesAction(
  meetingId: string,
  input: { fileId: string; parts?: { partNumber: number; etag: string }[] },
): Promise<{ error?: string }> {
  const actor = await requireActor();
  const parsed = z.object({ fileId: z.string(), parts }).safeParse(input);
  if (!parsed.success) return { error: "Nội dung không hợp lệ" };
  try {
    await app().core.files.completeUpload(actor, parsed.data);
    await app().core.scoring.attachMeetingMinutes(actor, { meetingId, fileId: parsed.data.fileId });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`/hoi-dong/van-ban/${meetingId}`);
  return {};
}

/** A short-lived link to biên bản number `number` (passed as the DownloadButton's id). */
export async function downloadMinutesAction(meetingId: string, number: string): Promise<{ url?: string; error?: string }> {
  const actor = await requireActor();
  try {
    const { url } = await app().core.scoring.downloadMeetingMinutes(actor, { meetingId, number: Number(number) });
    return { url };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}
