"use server";

import type { UploadInstructions } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const fileInput = z.object({ fileName: z.string().min(1), contentType: z.string(), size: z.number().int().positive() });

export async function requestUploadAction(input: z.infer<typeof fileInput>): Promise<{ fileId: string; upload: UploadInstructions } | { error: string }> {
  const actor = await requireActor();
  try {
    return await app().core.files.requestUpload(actor, fileInput.parse(input));
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

export async function completeUploadAction(fileId: string, parts?: { partNumber: number; etag: string }[]): Promise<{ error?: string }> {
  const actor = await requireActor();
  try {
    await app().core.files.completeUpload(actor, fileId, parts);
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/quan-tri/thu-tai-tep");
  return {};
}

export async function downloadAction(fileId: string): Promise<{ url?: string; error?: string }> {
  const actor = await requireActor();
  try {
    return { url: (await app().core.files.requestDownload(actor, fileId)).url };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}
