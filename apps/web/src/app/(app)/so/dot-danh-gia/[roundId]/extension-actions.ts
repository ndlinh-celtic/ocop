"use server";

import { EXTENDABLE_DEADLINES } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export interface ExtendDeadlineState {
  error?: string;
  /** Set after a successful extension, so the form can confirm it and reset. */
  done?: { reopened: boolean; at: number };
}

const extendForm = z.object({
  deadline: z.enum(EXTENDABLE_DEADLINES),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(1),
});

/** L07 Gia hạn đợt: moves Hạn nộp xã, Hạn gửi tỉnh or Hạn đánh giá tỉnh later, with a reason. */
export async function extendDeadlineAction(roundId: string, _prev: ExtendDeadlineState, form: FormData): Promise<ExtendDeadlineState> {
  const actor = await requireActor();
  const parsed = extendForm.safeParse({ deadline: form.get("deadline"), newDate: form.get("newDate"), reason: form.get("reason") });
  if (!parsed.success) return { error: "Chọn mốc hạn, ngày mới và nhập lý do gia hạn" };
  let reopened: boolean;
  try {
    ({ reopened } = await app().core.rounds.extendDeadline(actor, { roundId, ...parsed.data }));
  } catch (err) {
    return { error: domainMessage(err) };
  }
  revalidatePath("/so/dot-danh-gia");
  revalidatePath(`/so/dot-danh-gia/${roundId}`);
  return { done: { reopened, at: Date.now() } };
}
