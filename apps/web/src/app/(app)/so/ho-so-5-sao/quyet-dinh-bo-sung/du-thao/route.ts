import { DOCX_TYPE } from "@ocop/core";
import { z } from "zod";
import { app } from "@/server/app";
import { attachmentResponse, domainErrorResponse, textResponse } from "@/server/download";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * L17 (#88, spec #79 story 56): the dự thảo Quyết định công nhận bổ sung of the hồ sơ chờ picked (`?id=…&id=…`), as Word,
 * sinh on each request from the mẫu đang dùng; nothing is stored or changed.
 */
export async function GET(req: Request) {
  const actor = await requireActor();
  const parsed = z.array(z.string().min(1)).min(1).max(500).safeParse(new URL(req.url).searchParams.getAll("id"));
  if (!parsed.success) return textResponse("Chọn ít nhất một hồ sơ", 400);
  try {
    const doc = await app().core.results.supplementaryDecisionDraft(actor, { dossierIds: parsed.data });
    return attachmentResponse(doc.bytes, { fileName: doc.fileName, contentType: DOCX_TYPE, asciiName: "du-thao-quyet-dinh-bo-sung.docx" });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
