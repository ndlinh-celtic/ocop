import { DOCX_TYPE, MAX_ADVICE, MAX_CORRECTION_REASON } from "@ocop/core";
import { z } from "zod";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

const body = z.object({
  expectedVersion: z.number().int().nonnegative(),
  criterionIds: z.array(z.string()),
  advice: z.string().max(MAX_ADVICE),
  reason: z.string().max(MAX_CORRECTION_REASON).optional(),
});

const text = (message: string, status: number) => new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/**
 * L16 HD-10 (#85, story 36): the Thư kết quả không đạt as it would be issued, filled from the form, as Word; nothing is
 * stored. POST, since the form carries the lời khuyên.
 */
export async function POST(req: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return text("Nội dung thư không hợp lệ hoặc quá dài", 400);
  let doc;
  try {
    doc = await app()
      .core.results.previewResultLetter(actor, { dossierId, ...parsed.data })
      .catch(orNotFound);
  } catch (err) {
    return text(domainMessage(err), 409);
  }
  if (!doc) return text("Không tìm thấy hồ sơ", 404);
  return new Response(Buffer.from(doc.bytes), {
    headers: {
      "content-type": DOCX_TYPE,
      "content-disposition": `attachment; filename="thu-ket-qua.docx"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "cache-control": "no-store",
    },
  });
}
