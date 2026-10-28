"use server";

import { DOCX_TYPE, DomainError, TEMPLATE_KINDS, type DocumentTemplate, type UploadInstructions } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const kindSchema = z.enum(TEMPLATE_KINDS as [DocumentTemplate, ...DocumentTemplate[]]);
const fileInput = z.object({ fileName: z.string().min(1), size: z.number().int().positive() });

const revalidate = (kind: string) => {
  revalidatePath("/quan-tri/mau-van-ban");
  revalidatePath(`/quan-tri/mau-van-ban/${kind}`);
};

/** The edited Word file: a pre-signed upload, quarantined until scanned. */
export async function requestTemplateUploadAction(
  input: z.infer<typeof fileInput>,
): Promise<{ fileId: string; upload: UploadInstructions } | { error: string }> {
  const actor = await requireActor();
  const parsed = fileInput.safeParse(input);
  if (!parsed.success) return { error: "Chọn tệp Word (.docx)" };
  try {
    return await app().core.files.requestUpload(actor, { ...parsed.data, contentType: DOCX_TYPE, purpose: "document_template" });
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

export async function completeTemplateUploadAction(fileId: string, parts?: { partNumber: number; etag: string }[]): Promise<{ error?: string }> {
  const actor = await requireActor();
  try {
    await app().core.files.completeUpload(actor, { fileId, parts });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  return {};
}

const uploadInput = z.object({ kind: kindSchema, fileId: z.string().min(1), activate: z.boolean() });
export type UploadTemplateOutcome = { n: number } | { error: string; code: string };

/** Stories 73 to 75: the scanned file becomes the next phiên bản, if its variables check out. */
export async function uploadTemplateAction(input: z.infer<typeof uploadInput>): Promise<UploadTemplateOutcome> {
  const actor = await requireActor();
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { error: "Dữ liệu không hợp lệ", code: "invalid" };
  try {
    const { n } = await app().core.documents.uploadTemplate(actor, parsed.data);
    revalidate(parsed.data.kind);
    return { n };
  } catch (err) {
    return { error: domainMessage(err), code: err instanceof DomainError ? err.code : "error" };
  }
}

export interface ActivateState {
  error?: string;
}

/** Story 76: a phiên bản, or the mẫu mặc định (empty versionId), becomes the mẫu đang dùng. */
export async function activateTemplateAction(_prev: ActivateState, form: FormData): Promise<ActivateState> {
  const actor = await requireActor();
  const parsed = z.object({ kind: kindSchema, versionId: z.string() }).safeParse({ kind: form.get("kind"), versionId: form.get("versionId") ?? "" });
  if (!parsed.success) return { error: "Dữ liệu không hợp lệ" };
  try {
    await app().core.documents.activateTemplate(actor, { kind: parsed.data.kind, versionId: parsed.data.versionId || null });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidate(parsed.data.kind);
  return {};
}
