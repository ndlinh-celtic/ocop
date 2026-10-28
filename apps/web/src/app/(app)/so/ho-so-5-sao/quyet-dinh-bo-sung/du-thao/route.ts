import { DOCX_TYPE } from "@ocop/core";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * L17 (#88, spec #79 story 56): the dự thảo Quyết định công nhận bổ sung of the hồ sơ chờ picked (`?id=…&id=…`), as Word,
 * sinh on each request from the mẫu đang dùng; nothing is stored or changed.
 */
export async function GET(req: Request) {
  const actor = await requireActor();
  const parsed = z.array(z.string().min(1)).min(1).max(500).safeParse(new URL(req.url).searchParams.getAll("id"));
  if (!parsed.success) return new Response("Chọn ít nhất một hồ sơ", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  let doc;
  try {
    doc = await app().core.results.supplementaryDecisionDraft(actor, { dossierIds: parsed.data });
  } catch (err) {
    return new Response(domainMessage(err), { status: 409, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response(Buffer.from(doc.bytes), {
    headers: {
      "content-type": DOCX_TYPE,
      "content-disposition": `attachment; filename="du-thao-quyet-dinh-bo-sung.docx"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "cache-control": "no-store",
    },
  });
}
