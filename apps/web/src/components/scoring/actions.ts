"use server";

import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

/**
 * L10, L11 (#56 stories 43, 48, 63): a short-lived link to a minh chứng of the newest Phiên bản nộp or a tệp đính
 * kèm of the Báo cáo Tổ tư vấn; the use case decides from the Vai trò and Phạm vi which files the reader reaches.
 */
export async function downloadAdvisoryFileAction(dossierId: string, fileId: string): Promise<{ url?: string; error?: string }> {
  const actor = await requireActor();
  try {
    const { url } = await app().core.scoring.downloadAdvisoryFile(actor, { dossierId, fileId });
    return { url };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}
