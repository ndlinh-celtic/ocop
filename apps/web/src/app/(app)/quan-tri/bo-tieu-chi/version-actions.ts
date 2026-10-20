"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export type CopyOutcome = { versionId: string } | { error: string };
export type DeleteOutcome = { deleted: true } | { error: string };

const versionId = z.string().min(1);

/** L19 AD-04: copies a Phiên bản tiêu chí (draft or published) into a new draft. */
export async function copyVersionAction(id: string): Promise<CopyOutcome> {
  const actor = await requireActor();
  try {
    const copy = await app().core.criteria.copyVersion(actor, { versionId: versionId.parse(id) });
    revalidatePath("/quan-tri/bo-tieu-chi");
    return copy;
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

/** L19 AD-04: deletes a draft Phiên bản tiêu chí with its whole tree. */
export async function deleteVersionAction(id: string): Promise<DeleteOutcome> {
  const actor = await requireActor();
  try {
    await app().core.criteria.deleteVersion(actor, { versionId: versionId.parse(id) });
    revalidatePath("/quan-tri/bo-tieu-chi");
    return { deleted: true };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}
