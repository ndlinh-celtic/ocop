"use server";

import type { AdvisoryCopyPlan } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

/* S53 (L12 TM-08, TM-09; #58): xem trước and sao chép of a Báo cáo Tổ tư vấn phiên bản into the Phiếu chấm. */

const scope = {
  criteria: z.union([z.literal("all"), z.array(z.string().min(1).max(50)).min(1).max(500)]),
  recipients: z.union([z.literal("all"), z.array(z.string().min(1)).min(1).max(200)]),
};
const copyInput = z.object({
  dossiers: z
    .array(z.object({ dossierId: z.string().min(1), expectedVersion: z.number().int().positive(), advisoryVersionId: z.string().min(1).optional() }))
    .min(1)
    .max(200),
  ...scope,
});
export type CopyRequest = z.infer<typeof copyInput>;

export type CopyActionResult = { dossiers: (AdvisoryCopyPlan & { version?: number })[] } | { error: string };

/** Bước 3 (story 69): what the sao chép would do; nothing is written. */
export async function previewAdvisoryCopyAction(input: CopyRequest): Promise<CopyActionResult> {
  const parsed = copyInput.safeParse(input);
  if (!parsed.success) return { error: "Chọn hồ sơ, phạm vi và người nhận" };
  const actor = await requireActor();
  try {
    const { dossiers, ...rest } = parsed.data;
    return await app().core.scoring.previewAdvisoryCopy(actor, {
      ...rest,
      dossiers: dossiers.map((d) => ({ dossierId: d.dossierId, advisoryVersionId: d.advisoryVersionId })),
    });
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

/** Xác nhận sao chép (stories 65 to 70): the whole lô or nothing. */
export async function copyAdvisoryAction(input: CopyRequest): Promise<CopyActionResult> {
  const parsed = copyInput.safeParse(input);
  if (!parsed.success) return { error: "Chọn hồ sơ, phạm vi và người nhận" };
  const actor = await requireActor();
  try {
    const result = await app().core.scoring.copyAdvisory(actor, parsed.data);
    revalidatePath("/to-tu-van/sao-chep");
    return result;
  } catch (err) {
    return { error: domainMessage(err) };
  }
}
