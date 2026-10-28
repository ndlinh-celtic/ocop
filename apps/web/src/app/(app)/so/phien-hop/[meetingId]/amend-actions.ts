"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

const amendInput = z.object({ number: z.string(), signedOn: z.string(), reason: z.string() });

/** L16 HD-11 (#84, story 17): sửa số hoặc ngày ký of a recorded Quyết định công nhận, with a lý do. */
export async function amendDecisionAction(decisionId: string, input: z.infer<typeof amendInput>): Promise<{ error?: string }> {
  const actor = await requireActor();
  const parsed = amendInput.safeParse(input);
  if (!parsed.success) return { error: "Nội dung không hợp lệ" };
  try {
    await app().core.results.amendDecision(actor, { decisionId, ...parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/so/phien-hop", "layout");
  revalidatePath("/so/giay-chung-nhan");
  return {};
}
