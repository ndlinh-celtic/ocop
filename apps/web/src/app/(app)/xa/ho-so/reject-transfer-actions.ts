"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";
import type { WardDossierFormState } from "./actions";

const LIST = "/xa/ho-so";

/** The ground is "dk:<Điều kiện loại id>" or "ly-do:<Lý do loại sơ bộ>", from one select. */
const GROUND = /^(dk|ly-do):(.+)$/;
const rejectInput = z.object({ ground: z.string().regex(GROUND), explanation: z.string().max(2000) });

/** L05 XA-06 (story 63): loại the hồ sơ to Không đạt sơ bộ. */
export async function rejectDossierAction(
  dossierId: string,
  expectedVersion: number,
  _prev: WardDossierFormState,
  form: FormData,
): Promise<WardDossierFormState> {
  const actor = await requireActor();
  const parsed = rejectInput.safeParse({ ground: form.get("ground") ?? "", explanation: form.get("explanation") ?? "" });
  if (!parsed.success) return { error: "Chọn một Điều kiện loại hoặc một Lý do loại sơ bộ" };
  const [, kind, value] = GROUND.exec(parsed.data.ground)!;
  try {
    await app().core.dossiers.reject(actor, {
      dossierId,
      expectedVersion,
      ...(kind === "dk" ? { exclusionConditionId: value } : { reasonCode: value }),
      explanation: parsed.data.explanation,
    });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${dossierId}`);
  return { saved: true };
}

const transferInput = z.object({ wardId: z.string().trim().min(1), reason: z.string().trim().min(1).max(2000) });

/** Chuyển xã (story 47): once moved, this xã no longer sees the hồ sơ, so the officer goes back to the list. */
export async function transferWardAction(
  dossierId: string,
  expectedVersion: number,
  _prev: WardDossierFormState,
  form: FormData,
): Promise<WardDossierFormState> {
  const actor = await requireActor();
  const parsed = transferInput.safeParse({ wardId: form.get("wardId") ?? "", reason: form.get("reason") ?? "" });
  if (!parsed.success) return { error: "Chọn xã/phường nhận và nhập lý do chuyển" };
  try {
    await app().core.dossiers.transferWard(actor, { dossierId, expectedVersion, ...parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath(LIST);
  redirect(LIST);
}
