"use server";

import { DomainError, type ProductField, type UploadInstructions } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dossierHome } from "@/lib/dossier-paths";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor, requireActorFor } from "@/server/session";

/*
 * The Chủ thể's own hồ sơ actions. Each also takes `onBehalf`, a Chủ thể id, for Nhập hộ (L01): the
 * Cán bộ xã then acts for that Chủ thể through the same use cases, as the `*_on_behalf` actions.
 */

export interface DossierFormState {
  error?: string;
}

const onBehalf = z.string().min(1).optional();
const createInput = z.object({ criteriaSetId: z.string().min(1), sourceId: z.string().optional(), acknowledged: z.literal("on"), onBehalf });

/** L02 CT-03: a new Nháp on the chosen Bộ tiêu chí, or a copy of `sourceId` on it (story 27). */
export async function createDossierAction(_prev: DossierFormState, form: FormData): Promise<DossierFormState> {
  const parsed = createInput.safeParse({
    criteriaSetId: form.get("criteriaSetId") ?? "",
    sourceId: form.get("sourceId") || undefined,
    acknowledged: form.get("acknowledged"),
    onBehalf: form.get("onBehalf") || undefined,
  });
  if (!parsed.success) return { error: "Chọn một Bộ tiêu chí và xác nhận đã đọc lưu ý" };
  const { criteriaSetId, sourceId } = parsed.data;
  const actor = await requireActorFor(parsed.data.onBehalf);
  const home = dossierHome(parsed.data.onBehalf);
  let dossierId: string;
  try {
    ({ dossierId } = sourceId
      ? await app().core.dossiers.copy(actor, { dossierId: sourceId, criteriaSetId })
      : await app().core.dossiers.create(actor, { criteriaSetId }));
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(home);
  redirect(`${home}/${dossierId}`);
}

const field = z.string().max(10_000).optional();
const productInput = z.object({
  dossierId: z.string(),
  expectedVersion: z.number().int().positive(),
  productName: field,
  description: field,
  ingredients: field,
  process: field,
  packaging: field,
  qualityDeclaration: field,
  onBehalf,
} satisfies Record<ProductField | "dossierId" | "expectedVersion" | "onBehalf", z.ZodType>);

export type SaveResult = { version: number } | { error: string; conflict: boolean };

/** Autosave of thông tin sản phẩm (story 19); a stale version is reported so the editor can reload. */
export async function saveProductAction(input: z.infer<typeof productInput>): Promise<SaveResult> {
  const parsed = productInput.safeParse(input);
  if (!parsed.success) return { error: "Nội dung không hợp lệ", conflict: false };
  const { onBehalf: entityId, ...update } = parsed.data;
  const actor = await requireActorFor(entityId);
  try {
    return await app().core.dossiers.updateProduct(actor, update);
  } catch (err) {
    return { error: domainMessage(err), conflict: err instanceof DomainError && err.code === "version_conflict" };
  }
}

/** Story 26: deletes a Nháp never submitted. */
export async function deleteDossierAction(dossierId: string, expectedVersion: number, _prev: DossierFormState): Promise<DossierFormState> {
  const actor = await requireActor();
  try {
    await app().core.dossiers.delete(actor, { dossierId, expectedVersion });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(dossierHome());
  redirect(dossierHome());
}

/**
 * L03 CT-09: submits the hồ sơ into the đợt Đang nhận nộp, or (L04 CT-11) nộp lại a hồ sơ Yêu cầu bổ
 * sung; every blocker comes back in the message.
 */
export async function submitDossierAction(
  dossierId: string,
  expectedVersion: number,
  onBehalf: string | undefined,
  _prev: DossierFormState,
): Promise<DossierFormState> {
  const actor = await requireActorFor(onBehalf);
  try {
    await app().core.dossiers.submit(actor, { dossierId, expectedVersion });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(dossierHome(onBehalf));
  redirect(`${dossierHome(onBehalf)}/${dossierId}`);
}

const withdrawInput = z.object({ reason: z.string().trim().min(1).max(2_000) });

/** L03 story 33: rút a hồ sơ the xã has not Tiếp nhận yet, with a reason. */
export async function withdrawDossierAction(dossierId: string, expectedVersion: number, _prev: DossierFormState, form: FormData): Promise<DossierFormState> {
  const actor = await requireActor();
  const parsed = withdrawInput.safeParse({ reason: form.get("reason") ?? "" });
  if (!parsed.success) return { error: "Nhập lý do rút hồ sơ" };
  try {
    await app().core.dossiers.withdraw(actor, { dossierId, expectedVersion, reason: parsed.data.reason });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(dossierHome());
  redirect(`${dossierHome()}/${dossierId}`);
}

const answerInput = z.object({ response: z.string().max(2_000) });

export type AnswerFormState = DossierFormState & { saved?: boolean };

/** L04 CT-11 (story 51): the Chủ thể's answer to one nội dung of the open yêu cầu bổ sung. */
export async function respondSupplementAction(
  dossierId: string,
  expectedVersion: number,
  itemId: string,
  onBehalf: string | undefined,
  _prev: AnswerFormState,
  form: FormData,
): Promise<AnswerFormState> {
  const actor = await requireActorFor(onBehalf);
  const parsed = answerInput.safeParse({ response: form.get("response") ?? "" });
  if (!parsed.success) return { error: "Câu trả lời quá dài" };
  try {
    await app().core.dossiers.respondSupplementItem(actor, { dossierId, expectedVersion, itemId, response: parsed.data.response });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(`${dossierHome(onBehalf)}/${dossierId}`);
  return { saved: true };
}

const uploadInput = z.object({ fileName: z.string().min(1), contentType: z.string(), size: z.number().int().positive(), onBehalf });

/** L02 CT-05 step one: a pre-signed upload of a tệp minh chứng, quarantined until the virus scan (story 22). */
export async function requestEvidenceUploadAction(input: z.infer<typeof uploadInput>): Promise<{ fileId: string; upload: UploadInstructions } | { error: string }> {
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { error: "Chọn tệp minh chứng" };
  const { onBehalf: entityId, ...file } = parsed.data;
  const actor = await requireActorFor(entityId);
  try {
    return await app().core.files.requestUpload(actor, { ...file, purpose: "evidence" });
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

const editInput = z.object({ dossierId: z.string(), expectedVersion: z.number().int().positive(), onBehalf });
const parts = z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string() })).optional();

/** Step two: the upload is complete and the file goes into the kho minh chứng of the hồ sơ (story 20). */
export async function addEvidenceAction(input: z.infer<typeof editInput> & { fileId: string; parts?: { partNumber: number; etag: string }[] }): Promise<SaveResult> {
  const parsed = editInput.extend({ fileId: z.string(), parts }).safeParse(input);
  if (!parsed.success) return { error: "Nội dung không hợp lệ", conflict: false };
  const { parts: uploaded, onBehalf: entityId, ...add } = parsed.data;
  const actor = await requireActorFor(entityId);
  return save(add.dossierId, entityId, async () => {
    await app().core.files.completeUpload(actor, { fileId: add.fileId, parts: uploaded });
    return app().core.dossiers.addEvidenceFile(actor, add);
  });
}

/** Takes a file out of the kho minh chứng of the bản làm việc, with its ties to Tiêu chí. */
export async function removeEvidenceAction(input: z.infer<typeof editInput> & { fileId: string }): Promise<SaveResult> {
  const parsed = editInput.extend({ fileId: z.string() }).safeParse(input);
  if (!parsed.success) return { error: "Nội dung không hợp lệ", conflict: false };
  const { onBehalf: entityId, ...remove } = parsed.data;
  const actor = await requireActorFor(entityId);
  return save(remove.dossierId, entityId, () => app().core.dossiers.removeEvidenceFile(actor, remove));
}

/** Story 20: the Tiêu chí a file of the kho is tied to. */
export async function linkEvidenceAction(input: z.infer<typeof editInput> & { fileId: string; criterionIds: string[] }): Promise<SaveResult> {
  const parsed = editInput.extend({ fileId: z.string(), criterionIds: z.array(z.string()).max(500) }).safeParse(input);
  if (!parsed.success) return { error: "Nội dung không hợp lệ", conflict: false };
  const { onBehalf: entityId, ...link } = parsed.data;
  const actor = await requireActorFor(entityId);
  return save(link.dossierId, entityId, () => app().core.dossiers.linkEvidence(actor, link));
}

/** Story 23: the Mức điểm picked for a Tiêu chí when tự chấm thử; null clears it. */
export async function selfScoreAction(input: z.infer<typeof editInput> & { criterionId: string; levelId: string | null }): Promise<SaveResult> {
  const parsed = editInput.extend({ criterionId: z.string(), levelId: z.string().nullable() }).safeParse(input);
  if (!parsed.success) return { error: "Nội dung không hợp lệ", conflict: false };
  const { onBehalf: entityId, ...score } = parsed.data;
  const actor = await requireActorFor(entityId);
  return save(score.dossierId, entityId, () => app().core.dossiers.selfScore(actor, score));
}

/** Story 21: the giải trình of a Tiêu chí. */
export async function explainCriterionAction(input: z.infer<typeof editInput> & { criterionId: string; explanation: string }): Promise<SaveResult> {
  const parsed = editInput.extend({ criterionId: z.string(), explanation: z.string().max(10_000) }).safeParse(input);
  if (!parsed.success) return { error: "Giải trình quá dài", conflict: false };
  const { onBehalf: entityId, ...explain } = parsed.data;
  const actor = await requireActorFor(entityId);
  return save(explain.dossierId, entityId, () => app().core.dossiers.explainCriterion(actor, explain));
}

/** Runs one write of the hồ sơ editor; a stale version is reported so the editor can reload. */
async function save(dossierId: string, onBehalf: string | undefined, write: () => Promise<{ version: number }>): Promise<SaveResult> {
  try {
    const result = await write();
    revalidatePath(`${dossierHome(onBehalf)}/${dossierId}`);
    return result;
  } catch (err) {
    return { error: domainMessage(err), conflict: err instanceof DomainError && err.code === "version_conflict" };
  }
}
