"use server";

import { CriteriaValidationError, DomainError } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";
import { withReauth } from "@/server/with-reauth";

export type PublishOutcome = { published: true; publishedAt: string } | { published: false; error: string };

/** L19 AD-04: publishes a draft Phiên bản tiêu chí; asks for Xác thực lại when it is due. */
export async function publishVersionAction(versionId: string) {
  const actor = await requireActor();
  const id = z.string().min(1).parse(versionId);
  return withReauth(async (): Promise<PublishOutcome> => {
    try {
      const { publishedAt } = await app().core.criteria.publishVersion(actor, { versionId: id });
      revalidatePath("/quan-tri/bo-tieu-chi", "layout");
      revalidatePath("/tieu-chi", "layout");
      return { published: true, publishedAt: publishedAt.toISOString() };
    } catch (err) {
      if (err instanceof DomainError && err.code === "reauth_required") throw err; // withReauth asks for the proof
      if (err instanceof CriteriaValidationError) {
        revalidatePath(`/quan-tri/bo-tieu-chi/${id}`);
        return { published: false, error: err.message };
      }
      return { published: false, error: domainMessage(err) };
    }
  });
}
