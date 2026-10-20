"use server";

import { DomainError, type ProductField } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const LIST = "/chu-the/ho-so";

export interface DossierFormState {
  error?: string;
}

const createInput = z.object({ criteriaSetId: z.string().min(1), sourceId: z.string().optional(), acknowledged: z.literal("on") });

/** L02 CT-03: a new Nháp on the chosen Bộ tiêu chí, or a copy of `sourceId` on it (story 27). */
export async function createDossierAction(_prev: DossierFormState, form: FormData): Promise<DossierFormState> {
  const actor = await requireActor();
  const parsed = createInput.safeParse({
    criteriaSetId: form.get("criteriaSetId") ?? "",
    sourceId: form.get("sourceId") || undefined,
    acknowledged: form.get("acknowledged"),
  });
  if (!parsed.success) return { error: "Chọn một Bộ tiêu chí và xác nhận đã đọc lưu ý" };
  const { criteriaSetId, sourceId } = parsed.data;
  let dossierId: string;
  try {
    ({ dossierId } = sourceId
      ? await app().core.dossiers.copy(actor, { dossierId: sourceId, criteriaSetId })
      : await app().core.dossiers.create(actor, { criteriaSetId }));
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(LIST);
  redirect(`${LIST}/${dossierId}`);
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
} satisfies Record<ProductField | "dossierId" | "expectedVersion", z.ZodType>);

export type SaveResult = { version: number } | { error: string; conflict: boolean };

/** Autosave of thông tin sản phẩm (story 19); a stale version is reported so the editor can reload. */
export async function saveProductAction(input: z.infer<typeof productInput>): Promise<SaveResult> {
  const actor = await requireActor();
  const parsed = productInput.safeParse(input);
  if (!parsed.success) return { error: "Nội dung không hợp lệ", conflict: false };
  try {
    return await app().core.dossiers.updateProduct(actor, parsed.data);
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
  revalidatePath(LIST);
  redirect(LIST);
}
