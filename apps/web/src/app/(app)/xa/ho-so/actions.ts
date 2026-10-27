"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const LIST = "/xa/ho-so";

export interface WardDossierFormState {
  error?: string;
  saved?: boolean;
}

const handlerInput = z.object({ handlerUserId: z.string().trim().min(1) });

/** L05 XA-02 (story 40): Tiếp nhận, naming the Cán bộ phụ trách (the officer themself by default). */
export async function receiveDossierAction(
  dossierId: string,
  expectedVersion: number,
  _prev: WardDossierFormState,
  form: FormData,
): Promise<WardDossierFormState> {
  const actor = await requireActor();
  const parsed = handlerInput.safeParse({ handlerUserId: form.get("handlerUserId") ?? "" });
  try {
    await app().core.dossiers.receive(actor, { dossierId, expectedVersion, handlerUserId: parsed.success ? parsed.data.handlerUserId : null });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${dossierId}`);
  return { saved: true };
}

/** L05 XA-03 (story 41): another Cán bộ phụ trách for a received hồ sơ. */
export async function changeHandlerAction(
  dossierId: string,
  expectedVersion: number,
  _prev: WardDossierFormState,
  form: FormData,
): Promise<WardDossierFormState> {
  const actor = await requireActor();
  const parsed = handlerInput.safeParse({ handlerUserId: form.get("handlerUserId") ?? "" });
  if (!parsed.success) return { error: "Chọn Cán bộ phụ trách" };
  try {
    await app().core.dossiers.changeHandler(actor, { dossierId, expectedVersion, handlerUserId: parsed.data.handlerUserId });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${dossierId}`);
  return { saved: true };
}

const supplementInput = z.object({
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

/** L04 XA-05 (story 50): yêu cầu bổ sung with its nội dung (sent as JSON by the form) and hạn bổ sung. */
export async function requestSupplementAction(
  dossierId: string,
  expectedVersion: number,
  _prev: WardDossierFormState,
  form: FormData,
): Promise<WardDossierFormState> {
  const actor = await requireActor();
  let items: unknown;
  try {
    items = JSON.parse(String(form.get("items") ?? "[]"));
  } catch {
    items = [];
  }
  const parsed = supplementInput.safeParse({ deadline: form.get("deadline") ?? "", items });
  if (!parsed.success) return { error: "Nhập hạn bổ sung và ít nhất một nội dung cần bổ sung" };
  try {
    await app().core.dossiers.requestSupplement(actor, { dossierId, expectedVersion, ...parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${dossierId}`);
  return { saved: true };
}

/** L04 XA-05 (story 56): đóng hồ sơ quá hạn bổ sung về Không đạt sơ bộ, lý do "Không bổ sung". */
export async function closeUnsupplementedAction(dossierId: string, expectedVersion: number, _prev: WardDossierFormState): Promise<WardDossierFormState> {
  const actor = await requireActor();
  try {
    await app().core.dossiers.closeUnsupplemented(actor, { dossierId, expectedVersion });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${dossierId}`);
  return { saved: true };
}
