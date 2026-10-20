"use server";

import type { StarRank } from "@ocop/core";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export type PreviewState = { rank: StarRank } | { error: string };

const input = z.object({ setId: z.string().min(1), levelIds: z.array(z.string().min(1)).max(1000) });

/** L19 AD-03 chấm thử: ranks the chosen Mức điểm of a Bộ tiêu chí; nothing is stored. */
export async function previewSetAction(setId: string, levelIds: string[]): Promise<PreviewState> {
  const actor = await requireActor();
  const parsed = input.safeParse({ setId, levelIds });
  if (!parsed.success) return { error: "Lựa chọn không hợp lệ" };
  try {
    return { rank: await app().core.criteria.previewSet(actor, parsed.data) };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}
