"use server";

import { DomainError } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";
import { withReauth } from "@/server/with-reauth";

export type FinalizeOutcome = { finalized: true; star: number } | { finalized: false; error: string };

/** L15 HD-08 (story 116): chốt điểm a hồ sơ at the version the page showed; asks for Xác thực lại when it is due. */
export async function finalizeAction(dossierId: string, expectedVersion: number) {
  const actor = await requireActor();
  const input = z.object({ dossierId: z.string().min(1), expectedVersion: z.number().int().nonnegative() }).parse({ dossierId, expectedVersion });
  return withReauth(async (): Promise<FinalizeOutcome> => {
    try {
      const { star } = await app().core.scoring.finalize(actor, input);
      revalidatePath("/hoi-dong/chot-diem", "layout");
      revalidatePath("/hoi-dong/van-ban", "layout");
      return { finalized: true, star };
    } catch (err) {
      if (err instanceof DomainError && err.code === "reauth_required") throw err; // withReauth asks for the proof
      return { finalized: false, error: domainMessage(err) };
    }
  });
}
