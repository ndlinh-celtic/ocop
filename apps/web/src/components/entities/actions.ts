"use server";

import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

/**
 * Reads of one Chủ thể shared by the Chủ thể's own pages and the Cán bộ xã's: the use cases decide, from
 * the Vai trò đang dùng, whether the Chủ thể is within Phạm vi.
 */

/** Stories 13, 14: the full số định danh cá nhân, an audited personal data access. */
export async function revealPersonalIdAction(entityId: string): Promise<{ personalId?: string; error?: string }> {
  const actor = await requireActor();
  try {
    return await app().core.entities.revealPersonalId(actor, { entityId });
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

/** A short-lived link to the file of one giấy tờ pháp lý. */
export async function downloadLegalDocumentAction(entityId: string, documentId: string): Promise<{ url?: string; error?: string }> {
  const actor = await requireActor();
  try {
    return { url: (await app().core.entities.downloadLegalDocument(actor, { entityId, documentId })).url };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}
