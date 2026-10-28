"use server";

import { FIVE_STAR_CLOSURE_OUTCOMES, type UploadInstructions } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const PATH = "/so/ho-so-5-sao";
const uploadInput = z.object({ fileName: z.string().min(1), contentType: z.string(), size: z.number().int().positive() });
const parts = z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string() })).optional();
const markInput = z.object({ expectedVersion: z.number().int(), dispatchNumber: z.string(), sentOn: z.string() });
const returnInput = z.object({ expectedVersion: z.number().int(), fileId: z.string(), parts });
const closeInput = z.object({
  expectedVersion: z.number().int(),
  outcome: z.enum(FIVE_STAR_CLOSURE_OUTCOMES),
  decisionNumber: z.string().optional(),
  decidedOn: z.string().optional(),
  fileId: z.string(),
  parts,
});

const done = (dossierId: string) => {
  revalidatePath(PATH);
  revalidatePath(`/so/ho-so/${dossierId}`);
  return {};
};

/** L17 SO-04 (#87): a pre-signed upload of the Bộ's văn bản (PDF), for chuyển về or đóng hồ sơ. */
export async function requestMinistryUploadAction(
  input: z.infer<typeof uploadInput>,
): Promise<{ fileId: string; upload: UploadInstructions } | { error: string }> {
  const actor = await requireActor();
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { error: "Chọn tệp PDF văn bản của Bộ" };
  try {
    return await app().core.files.requestUpload(actor, { ...parsed.data, purpose: "ministry_document" });
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

/** Story 53: đánh dấu đã gửi with the số công văn and ngày gửi. */
export async function markSentAction(dossierId: string, input: z.infer<typeof markInput>): Promise<{ error?: string }> {
  const actor = await requireActor();
  const parsed = markInput.safeParse(input);
  if (!parsed.success) return { error: "Nội dung không hợp lệ" };
  try {
    await app().core.results.markFiveStarSent(actor, { dossierId, ...parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  return done(dossierId);
}

/** Story 54: chuyển về công nhận cấp tỉnh, once the Bộ's văn bản is uploaded. */
export async function returnToProvinceAction(dossierId: string, input: z.infer<typeof returnInput>): Promise<{ error?: string }> {
  const actor = await requireActor();
  const parsed = returnInput.safeParse(input);
  if (!parsed.success) return { error: "Nội dung không hợp lệ" };
  const { fileId, parts: uploaded, expectedVersion } = parsed.data;
  try {
    await app().core.files.completeUpload(actor, { fileId, parts: uploaded });
    await app().core.results.returnFiveStarToProvince(actor, { dossierId, expectedVersion, fileId });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  return done(dossierId);
}

/** Stories 58, 59: đóng hồ sơ on the Bộ's answer, once its văn bản is uploaded. */
export async function closeAction(dossierId: string, input: z.infer<typeof closeInput>): Promise<{ error?: string }> {
  const actor = await requireActor();
  const parsed = closeInput.safeParse(input);
  if (!parsed.success) return { error: "Nội dung không hợp lệ" };
  const { fileId, parts: uploaded, ...rest } = parsed.data;
  try {
    await app().core.files.completeUpload(actor, { fileId, parts: uploaded });
    await app().core.results.closeFiveStar(actor, { dossierId, fileId, ...rest });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  return done(dossierId);
}

const ministryDocumentInput = z.object({ dossierId: z.string().min(1), fileId: z.string().min(1) });

/** A short-lived link to the Bộ's văn bản of a hồ sơ; the page binds the hồ sơ, the DownloadButton passes the file. */
export async function downloadMinistryDocumentAction(dossierId: string, fileId: string): Promise<{ url?: string; error?: string }> {
  const actor = await requireActor();
  const parsed = ministryDocumentInput.safeParse({ dossierId, fileId });
  if (!parsed.success) return { error: "Không tìm thấy văn bản của Bộ" };
  try {
    const { url } = await app().core.results.downloadMinistryDocument(actor, parsed.data);
    return { url };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

const packageInput = z.object({ dossierIds: z.array(z.string().min(1)).min(1, "Chọn ít nhất một hồ sơ để xuất gói") });

export type ExportPackageState = { error?: string; requested?: boolean };

/** L17 SO-04 (#89, stories 47 to 52): xuất Gói đề nghị 5 sao for the hồ sơ ticked in the list; a job builds it. */
export async function exportPackageAction(_prev: ExportPackageState, form: FormData): Promise<ExportPackageState> {
  const actor = await requireActor();
  const parsed = packageInput.safeParse({ dossierIds: form.getAll("dossierIds").map(String) });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Chọn hồ sơ để xuất gói" };
  try {
    await app().core.results.requestFiveStarPackage(actor, parsed.data);
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(PATH);
  return { requested: true };
}
