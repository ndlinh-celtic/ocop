import { DOCX_TYPE, MAX_ADVICE, MAX_CORRECTION_REASON } from "@ocop/core";
import { z } from "zod";
import { app } from "@/server/app";
import { attachmentResponse, domainErrorResponse, textResponse } from "@/server/download";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

const body = z.object({
  expectedVersion: z.number().int().nonnegative(),
  criterionIds: z.array(z.string()),
  advice: z.string().max(MAX_ADVICE),
  reason: z.string().max(MAX_CORRECTION_REASON).optional(),
});

/**
 * L16 HD-10 (#85, story 36): the Thư kết quả không đạt as it would be issued, filled from the form, as Word; nothing is
 * stored. POST, since the form carries the lời khuyên.
 */
export async function POST(req: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return textResponse("Nội dung thư không hợp lệ hoặc quá dài", 400);
  try {
    const doc = await app().core.results.previewResultLetter(actor, { dossierId, ...parsed.data });
    return attachmentResponse(doc.bytes, { fileName: doc.fileName, contentType: DOCX_TYPE, asciiName: "thu-ket-qua.docx" });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
