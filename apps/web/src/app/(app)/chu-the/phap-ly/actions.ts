"use server";

import type { UploadInstructions } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const PAGE = "/chu-the/phap-ly";
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const fileInput = z.object({ fileName: z.string().min(1), contentType: z.string(), size: z.number().int().positive() });

/** Step one of a giấy tờ (L01 CT-02): a pre-signed upload of the file, quarantined until scanned. */
export async function requestLegalUploadAction(input: z.infer<typeof fileInput>): Promise<{ fileId: string; upload: UploadInstructions } | { error: string }> {
  const actor = await requireActor();
  try {
    return await app().core.files.requestUpload(actor, { ...fileInput.parse(input), purpose: "legal_document" });
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

export async function completeLegalUploadAction(fileId: string, parts?: { partNumber: number; etag: string }[]): Promise<{ error?: string }> {
  const actor = await requireActor();
  try {
    await app().core.files.completeUpload(actor, { fileId, parts });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  return {};
}

const documentInput = z.object({
  entityId: z.string(),
  typeCode: z.string().min(1),
  fileId: z.string(),
  documentNumber: z.string().optional(),
  issuedOn: date,
  validUntil: date.nullable(),
  replacesId: z.string().optional(),
});

/** Step two: the uploaded file becomes a giấy tờ, or replaces one of the same Loại. */
export async function addLegalDocumentAction(input: z.infer<typeof documentInput>): Promise<{ error?: string }> {
  const actor = await requireActor();
  const parsed = documentInput.safeParse(input);
  if (!parsed.success) return { error: "Điền đủ loại giấy tờ, ngày cấp và chọn tệp" };
  try {
    await app().core.entities.addLegalDocument(actor, parsed.data);
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(PAGE);
  return {};
}

export interface EntityFormState {
  error?: string;
  saved?: boolean;
}

const text = z.string().trim().min(1);
const detailsInput = z.object({ name: text, address: text, representativeName: text, phone: text, wardId: text });

/** Stories 9, 10: the Chủ thể edits its details or moves to another xã/phường đăng ký. */
export async function updateEntityAction(entityId: string, _prev: EntityFormState, form: FormData): Promise<EntityFormState> {
  const actor = await requireActor();
  const parsed = detailsInput.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { error: "Điền đủ các trường bắt buộc" };
  try {
    await app().core.entities.updateEntity(actor, { entityId, ...parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(PAGE);
  return { saved: true };
}
