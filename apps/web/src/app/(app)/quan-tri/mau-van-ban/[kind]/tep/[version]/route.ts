import { DOCX_TYPE, TEMPLATE_KINDS, type DocumentTemplate } from "@ocop/core";
import { notFound } from "next/navigation";
import { z } from "zod";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * #82 stories 71, 77: the Word file of a phiên bản mẫu, or of the mẫu mặc định (`mac-dinh`); with `?sinh-thu` the same
 * template filled with the dữ liệu mẫu cố định. Nothing is stored.
 */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string; version: string }> }) {
  const actor = await requireActor();
  const parsed = z.object({ kind: z.enum(TEMPLATE_KINDS as [DocumentTemplate, ...DocumentTemplate[]]), version: z.string().min(1) }).safeParse(await params);
  if (!parsed.success) notFound();
  const input = { kind: parsed.data.kind, versionId: parsed.data.version === "mac-dinh" ? null : parsed.data.version };
  const docs = app().core.documents;
  const preview = new URL(req.url).searchParams.has("sinh-thu");
  const doc = await (preview ? docs.previewTemplate(actor, input) : docs.downloadTemplate(actor, input)).catch(orNotFound);
  if (!doc) notFound();
  return new Response(Buffer.from(doc.bytes), {
    headers: {
      "content-type": DOCX_TYPE,
      "content-disposition": `attachment; filename="mau-${parsed.data.kind}.docx"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "cache-control": "no-store",
    },
  });
}
