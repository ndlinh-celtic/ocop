"use server";

import { DomainError, type DossierState, type UploadInstructions } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";
import { withReauth } from "@/server/with-reauth";

/* L14 TV-05..07 (#54): the thành viên chấm's own Phiếu chấm on S61 and its xác nhận on S62. */

export type SheetSaveResult = { version: number } | { error: string; conflict: boolean };

const lineInput = z.object({
  criterionId: z.string().min(1),
  levelId: z.string().min(1).nullable(),
  comment: z.string().max(10_000),
  evidenceFileIds: z.array(z.string().min(1)).max(50),
});
const saveInput = z.object({ dossierId: z.string().min(1), expectedVersion: z.number().int().positive(), lines: z.array(lineInput).min(1).max(500) });

/** Lưu nháp: the dòng changed since the page loaded (stories 83, 86, 88). */
export async function saveScoreSheetAction(input: z.infer<typeof saveInput>): Promise<SheetSaveResult> {
  const parsed = saveInput.safeParse(input);
  if (!parsed.success) return { error: "Nội dung phiếu không hợp lệ", conflict: false };
  const actor = await requireActor();
  try {
    const { version } = await app().core.scoring.saveScoreSheet(actor, parsed.data);
    revalidatePath(`/thanh-vien/ho-so/${parsed.data.dossierId}`);
    return { version };
  } catch (err) {
    return { error: domainMessage(err), conflict: err instanceof DomainError && err.code === "version_conflict" };
  }
}

export type ConfirmOutcome = { confirmed: true; dossierState: DossierState } | { confirmed: false; error: string };

/** S62 (stories 89, 90): xác nhận after Xác thực lại, which withReauth asks for when it is due. */
export async function confirmScoreSheetAction(dossierId: string, expectedVersion: number) {
  const actor = await requireActor();
  const input = z.object({ dossierId: z.string().min(1), expectedVersion: z.number().int().positive() }).parse({ dossierId, expectedVersion });
  return withReauth(async (): Promise<ConfirmOutcome> => {
    try {
      const { dossierState } = await app().core.scoring.confirmScoreSheet(actor, input);
      revalidatePath(`/thanh-vien/ho-so/${input.dossierId}`);
      revalidatePath("/thanh-vien/ho-so");
      return { confirmed: true, dossierState };
    } catch (err) {
      if (err instanceof DomainError && err.code === "reauth_required") throw err;
      return { confirmed: false, error: domainMessage(err) };
    }
  });
}

const uploadInput = z.object({ fileName: z.string().min(1).max(255), contentType: z.string().min(1), size: z.number().int().positive() });

/** Step one of a bằng chứng kiểm tra upload (story 86): where the browser sends the file. */
export async function requestGradingEvidenceUploadAction(input: z.infer<typeof uploadInput>): Promise<{ fileId: string; upload: UploadInstructions } | { error: string }> {
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { error: "Chọn tệp bằng chứng" };
  const actor = await requireActor();
  try {
    return await app().core.files.requestUpload(actor, { ...parsed.data, purpose: "grading_evidence" });
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

/** Step two: the upload is complete and the scan starts; the form then ties the file to its Tiêu chí. */
export async function completeGradingEvidenceUploadAction(fileId: string, parts?: { partNumber: number; etag: string }[]): Promise<{ ok: true } | { error: string }> {
  const actor = await requireActor();
  try {
    await app().core.files.completeUpload(actor, { fileId, parts });
    return { ok: true };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

/** A short-lived link to one of the thành viên's own bằng chứng kiểm tra. */
export async function downloadGradingEvidenceAction(fileId: string): Promise<{ url?: string; error?: string }> {
  const actor = await requireActor();
  try {
    const { url } = await app().core.files.requestDownload(actor, { fileId });
    return { url };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}
