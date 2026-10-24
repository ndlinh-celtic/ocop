"use server";

import { DomainError, type UploadInstructions } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";
import { withReauth } from "@/server/with-reauth";

const PAGE = "/quan-tri/mo-khoa-sau-chot";
const fileInput = z.object({ fileName: z.string().min(1), contentType: z.string(), size: z.number().int().positive() });

/** The văn bản yêu cầu of the Hội đồng (PDF): a pre-signed upload, quarantined until scanned. */
export async function requestUnlockFileUploadAction(input: z.infer<typeof fileInput>): Promise<{ fileId: string; upload: UploadInstructions } | { error: string }> {
  const actor = await requireActor();
  try {
    return await app().core.files.requestUpload(actor, { ...fileInput.parse(input), purpose: "unlock_request" });
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

export async function completeUnlockFileUploadAction(fileId: string, parts?: { partNumber: number; etag: string }[]): Promise<{ error?: string }> {
  const actor = await requireActor();
  try {
    await app().core.files.completeUpload(actor, { fileId, parts });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  return {};
}

const unlockInput = z.object({ dossierId: z.string().min(1), requestFileId: z.string().min(1), requestedBy: z.string(), reason: z.string() });
export type UnlockOutcome = { unlocked: true } | { unlocked: false; error: string };

/** L15 Mở khóa sau chốt (stories 127 to 131); asks for Xác thực lại when it is due. */
export async function unlockAction(input: z.infer<typeof unlockInput>) {
  const actor = await requireActor();
  const parsed = unlockInput.safeParse(input);
  return withReauth(async (): Promise<UnlockOutcome> => {
    if (!parsed.success) return { unlocked: false, error: "Nhập đủ hồ sơ, văn bản yêu cầu, người yêu cầu và lý do" };
    try {
      await app().core.scoring.unlockFinalized(actor, parsed.data);
      revalidatePath(PAGE);
      return { unlocked: true };
    } catch (err) {
      if (err instanceof DomainError && err.code === "reauth_required") throw err; // withReauth asks for the proof
      return { unlocked: false, error: domainMessage(err) };
    }
  });
}
