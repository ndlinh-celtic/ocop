"use server";

import type { UploadInstructions } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const uploadInput = z.object({ fileName: z.string().min(1), contentType: z.string(), size: z.number().int().positive() });
const signedInput = z.object({
  fileId: z.string(),
  parts: z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string() })).optional(),
  reason: z.string().max(1000).optional(),
});

/** L16 HD-11 (#84, story 28) step one: a pre-signed upload of the signed Giấy chứng nhận (PDF). */
export async function requestSignedUploadAction(
  input: z.infer<typeof uploadInput>,
): Promise<{ fileId: string; upload: UploadInstructions } | { error: string }> {
  const actor = await requireActor();
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { error: "Chọn tệp PDF đã ký" };
  try {
    return await app().core.files.requestUpload(actor, { ...parsed.data, purpose: "signed_certificate" });
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

/** Step two: the upload is complete; the giấy becomes Đã ký (a re-upload carries its lý do, story 29). */
export async function uploadSignedAction(certificateId: string, input: z.infer<typeof signedInput>): Promise<{ error?: string }> {
  const actor = await requireActor();
  const parsed = signedInput.safeParse(input);
  if (!parsed.success) return { error: "Nội dung không hợp lệ" };
  const { fileId, parts, reason } = parsed.data;
  try {
    await app().core.files.completeUpload(actor, { fileId, parts });
    await app().core.results.uploadSignedCertificate(actor, { certificateId, fileId, reason });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/so/giay-chung-nhan");
  return {};
}

/** A short-lived link to the bản nháp of a giấy (its id passed as the DownloadButton's id). */
export async function downloadDraftAction(certificateId: string): Promise<{ url?: string; error?: string }> {
  const actor = await requireActor();
  try {
    return { url: (await app().core.results.downloadCertificate(actor, { certificateId, version: "draft" })).url };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

/** A short-lived link to the newest signed PDF of a giấy. */
export async function downloadSignedAction(certificateId: string): Promise<{ url?: string; error?: string }> {
  const actor = await requireActor();
  try {
    return { url: (await app().core.results.downloadCertificate(actor, { certificateId, version: "signed" })).url };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}
