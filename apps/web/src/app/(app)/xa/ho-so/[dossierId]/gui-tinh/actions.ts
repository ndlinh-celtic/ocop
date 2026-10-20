"use server";

import type { UploadInstructions } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const uploadInput = z.object({ fileName: z.string().min(1), contentType: z.string(), size: z.number().int().positive() });
const parts = z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string() })).optional();

/** L06 XA-07 (story 65) step one: a pre-signed upload of the signed Báo cáo đánh giá cấp xã (PDF). */
export async function requestSignedReportUploadAction(input: z.infer<typeof uploadInput>): Promise<{ fileId: string; upload: UploadInstructions } | { error: string }> {
  const actor = await requireActor();
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { error: "Chọn tệp PDF đã ký" };
  try {
    return await app().core.files.requestUpload(actor, { ...parsed.data, purpose: "signed_ward_report" });
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

/** Step two: the upload is complete and the PDF becomes the hồ sơ's signed report; the scan runs after. */
export async function attachSignedReportAction(
  dossierId: string,
  expectedVersion: number,
  input: { fileId: string; parts?: { partNumber: number; etag: string }[] },
): Promise<{ error?: string }> {
  const actor = await requireActor();
  const parsed = z.object({ fileId: z.string(), parts }).safeParse(input);
  if (!parsed.success) return { error: "Nội dung không hợp lệ" };
  try {
    await app().core.files.completeUpload(actor, parsed.data);
    await app().core.dossiers.attachSignedWardReport(actor, { dossierId, expectedVersion, fileId: parsed.data.fileId });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`/xa/ho-so/${dossierId}`);
  return {};
}

/** Stories 66, 67: gửi tỉnh, then back to the hồ sơ, now read-only for the xã. */
export async function forwardAction(dossierId: string, expectedVersion: number, _prev: { error?: string }, _form: FormData): Promise<{ error?: string }> {
  const actor = await requireActor();
  try {
    await app().core.dossiers.forwardToProvince(actor, { dossierId, expectedVersion });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/xa/ho-so");
  redirect(`/xa/ho-so/${dossierId}`);
}
