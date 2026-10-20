"use server";

import type { DraftEdit } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export type EditOutcome = { ok: true; issueCount: number } | { ok: false; error: string };

/**
 * L19 AD-03: one edit of a draft Phiên bản tiêu chí. The core checks `edit` against its own schema
 * (draftEditSchema), so it is passed through as received.
 */
export async function editDraftAction(versionId: string, edit: DraftEdit): Promise<EditOutcome> {
  const actor = await requireActor();
  const id = z.string().min(1).parse(versionId);
  try {
    const { issues } = await app().core.criteria.editDraft(actor, { versionId: id, edit });
    // The draft page, its Bộ tiêu chí pages and the list (Văn bản căn cứ) all show what changed.
    revalidatePath("/quan-tri/bo-tieu-chi", "layout");
    return { ok: true, issueCount: issues.length };
  } catch (err) {
    return { ok: false, error: domainMessage(err) };
  }
}
