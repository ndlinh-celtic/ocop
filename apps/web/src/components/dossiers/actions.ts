"use server";

import { SUBMISSION_DOCUMENTS, type SubmissionDocument } from "@ocop/core";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

/**
 * #37: a short-lived link to the Phiếu đăng ký or Báo cáo tự đánh giá of one Phiên bản nộp, shared by the
 * Chủ thể's pages and the Cán bộ xã's; the use case decides from the Phạm vi whether the hồ sơ is visible.
 */
export async function downloadSubmissionDocumentAction(
  dossierId: string,
  submissionNumber: number,
  document: string,
): Promise<{ url?: string; error?: string }> {
  const actor = await requireActor();
  if (!SUBMISSION_DOCUMENTS.includes(document as SubmissionDocument)) return { error: "Không tìm thấy văn bản" };
  try {
    const { url } = await app().core.dossiers.downloadSubmissionDocument(actor, { dossierId, submissionNumber, document: document as SubmissionDocument });
    return { url };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

/** L06 XA-07 (story 35): a short-lived link to the signed Báo cáo đánh giá cấp xã, for the xã and the Chủ thể. */
export async function downloadSignedWardReportAction(dossierId: string): Promise<{ url?: string; error?: string }> {
  const actor = await requireActor();
  try {
    const { url } = await app().core.dossiers.downloadSignedWardReport(actor, { dossierId });
    return { url };
  } catch (err) {
    return { error: domainMessage(err) };
  }
}
