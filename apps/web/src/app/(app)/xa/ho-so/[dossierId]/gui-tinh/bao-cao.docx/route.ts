import { DOCX_TYPE } from "@ocop/core";
import { notFound } from "next/navigation";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * L06 XA-07 (story 64): the Báo cáo đánh giá cấp xã of a hồ sơ as Word, generated on each request from
 * the newest Phiên bản nộp and the Checklist sơ bộ. A hồ sơ outside the xã is not found.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  let report;
  try {
    report = await app().core.dossiers.generateWardReport(actor, { dossierId }).catch(orNotFound);
  } catch (err) {
    return new Response(domainMessage(err), { status: 409, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (!report) notFound();
  return new Response(Buffer.from(report.bytes), {
    headers: {
      "content-type": DOCX_TYPE,
      "content-disposition": `attachment; filename="bao-cao-danh-gia-cap-xa.docx"; filename*=UTF-8''${encodeURIComponent(report.fileName)}`,
      "cache-control": "no-store",
    },
  });
}
