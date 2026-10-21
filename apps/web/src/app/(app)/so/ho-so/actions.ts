"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const LIST = "/so/ho-so";

export interface ProvinceDossierFormState {
  error?: string;
  saved?: boolean;
}

const returnInput = z.object({
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z
    .array(
      z.object({
        content: z.string().trim().min(1).max(2_000),
        criterionId: z.string().optional(),
        legalDocumentTypeCode: z.string().optional(),
      }),
    )
    .min(1)
    .max(50),
});

/** L04 (story 57): Sở trả về a hồ sơ Đã chuyển tỉnh, with the nội dung (sent as JSON by the form) and hạn bổ sung. */
export async function returnFromProvinceAction(
  dossierId: string,
  expectedVersion: number,
  _prev: ProvinceDossierFormState,
  form: FormData,
): Promise<ProvinceDossierFormState> {
  const actor = await requireActor();
  let items: unknown;
  try {
    items = JSON.parse(String(form.get("items") ?? "[]"));
  } catch {
    items = [];
  }
  const parsed = returnInput.safeParse({ deadline: form.get("deadline") ?? "", items });
  if (!parsed.success) return { error: "Nhập hạn bổ sung và ít nhất một nội dung cần bổ sung" };
  try {
    await app().core.dossiers.returnFromProvince(actor, { dossierId, expectedVersion, ...parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${dossierId}`);
  return { saved: true };
}

/** L08 SO-02 (stories 15, 16): Tiếp nhận tại tỉnh a hồ sơ Đã chuyển tỉnh, once per lượt gửi tỉnh. */
export async function receiveAtProvinceAction(dossierId: string, expectedVersion: number, _prev: ProvinceDossierFormState): Promise<ProvinceDossierFormState> {
  const actor = await requireActor();
  try {
    await app().core.dossiers.receiveAtProvince(actor, { dossierId, expectedVersion });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${dossierId}`);
  return { saved: true };
}
