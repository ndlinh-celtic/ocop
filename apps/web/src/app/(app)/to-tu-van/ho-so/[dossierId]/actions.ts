"use server";

import { AdvisoryReportIncomplete, EVIDENCE_ASSESSMENTS, type UploadInstructions } from "@ocop/core";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

/** The whole Báo cáo Tổ tư vấn content as the editor sends it (L10 TM-05, TM-06). */
const content = z.object({
  lines: z.array(
    z.object({
      criterionId: z.string(),
      levelId: z.string().nullable(),
      basis: z.string().max(20_000),
      evidenceFileIds: z.array(z.string()).max(50),
      evidenceAssessment: z.enum(EVIDENCE_ASSESSMENTS).nullable(),
    }),
  ),
  summary: z.string().max(20_000),
  notes: z.string().max(20_000),
  attachmentFileIds: z.array(z.string()).max(50),
});
export type AdvisoryContentInput = z.infer<typeof content>;

const paths = (dossierId: string) => {
  revalidatePath(`/to-tu-van/ho-so/${dossierId}`);
  revalidatePath(`/to-tu-van/ho-so/${dossierId}/bao-cao`);
};

/** Stories 44 to 50: lưu nháp; a colleague's newer save is reported, never overwritten. */
export async function saveAdvisoryDraftAction(dossierId: string, draftVersion: number, input: AdvisoryContentInput): Promise<{ error?: string; draftVersion?: number }> {
  const actor = await requireActor();
  const parsed = content.safeParse(input);
  if (!parsed.success) return { error: "Nội dung báo cáo không hợp lệ" };
  try {
    const saved = await app().core.scoring.saveAdvisoryDraft(actor, { dossierId, draftVersion, ...parsed.data });
    paths(dossierId);
    return saved;
  } catch (err) {
    const message = domainMessage(err);
    return { error: (err as { code?: string }).code === "version_conflict" ? "Đồng nghiệp đã lưu bản nháp trước anh/chị. Tải lại trang để xem bản mới nhất." : message };
  }
}

/** Stories 56, 57: phát hành phiên bản 1; refused with the Tiêu chí still lacking Điểm đề xuất or căn cứ. */
export async function issueAdvisoryReportAction(dossierId: string, expectedVersion: number, _prev: { error?: string }, _form: FormData): Promise<{ error?: string }> {
  const actor = await requireActor();
  try {
    await app().core.scoring.issueAdvisoryReport(actor, { dossierId, expectedVersion });
  } catch (err) {
    if (err instanceof AdvisoryReportIncomplete) return { error: err.message };
    return { error: domainMessage(err) };
  }
  paths(dossierId);
  revalidatePath("/to-tu-van/hang-doi");
  return {};
}

/** Stories 60, 61: phiên bản N+1 from the content edited from phiên bản N, with its reason. */
export async function reissueAdvisoryReportAction(dossierId: string, expectedVersion: number, reason: string, input: AdvisoryContentInput): Promise<{ error?: string }> {
  const actor = await requireActor();
  const parsed = content.safeParse(input);
  if (!parsed.success) return { error: "Nội dung báo cáo không hợp lệ" };
  try {
    await app().core.scoring.reissueAdvisoryReport(actor, { dossierId, expectedVersion, reason, ...parsed.data });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  paths(dossierId);
  return {};
}

const uploadInput = z.object({ fileName: z.string().min(1), contentType: z.string(), size: z.number().int().positive() });

/** Story 48 step one: a pre-signed upload of a biên bản or ảnh kiểm tra thực địa. */
export async function requestAdvisoryAttachmentUploadAction(input: z.infer<typeof uploadInput>): Promise<{ fileId: string; upload: UploadInstructions } | { error: string }> {
  const actor = await requireActor();
  const parsed = uploadInput.safeParse(input);
  if (!parsed.success) return { error: "Chọn tệp để tải lên" };
  try {
    return await app().core.files.requestUpload(actor, { ...parsed.data, purpose: "advisory_attachment" });
  } catch (err) {
    return { error: domainMessage(err) };
  }
}

/** Step two: the upload is complete; the editor adds the file to the nháp at its next lưu nháp, while the scan runs. */
export async function completeAdvisoryAttachmentAction(input: { fileId: string; parts?: { partNumber: number; etag: string }[] }): Promise<{ error?: string }> {
  const actor = await requireActor();
  const parsed = z.object({ fileId: z.string(), parts: z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string() })).optional() }).safeParse(input);
  if (!parsed.success) return { error: "Nội dung không hợp lệ" };
  try {
    await app().core.files.completeUpload(actor, parsed.data);
  } catch (err) {
    return { error: domainMessage(err) };
  }
  return {};
}

/** L10 TM-03 (#57 story 51): a Thành viên Tổ tư vấn asks the Sở to trả về the hồ sơ to the xã, with a lý do. */
export async function requestAdvisoryReturnAction(dossierId: string, expectedVersion: number, _prev: { error?: string; saved?: boolean }, form: FormData) {
  const actor = await requireActor();
  const reason = String(form.get("reason") ?? "").trim();
  if (!reason) return { error: "Nhập lý do đề nghị trả về" };
  try {
    await app().core.dossiers.requestAdvisoryReturn(actor, { dossierId, expectedVersion, reason });
  } catch (err) {
    return { error: domainMessage(err) };
  }
  paths(dossierId);
  revalidatePath(`/so/ho-so/${dossierId}`);
  return { saved: true };
}
