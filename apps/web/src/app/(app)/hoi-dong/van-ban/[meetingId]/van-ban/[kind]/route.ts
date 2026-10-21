import { DOCX_TYPE, MEETING_DOCUMENT_KINDS } from "@ocop/core";
import { notFound } from "next/navigation";
import { z } from "zod";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * L15 HD-09 (stories 110 to 114): one văn bản họp of a Phiên họp as Word, sinh on each request from the kết quả
 * chốt and the điểm tính tại chỗ, so a download after chốt has the số liệu cuối. Another Hội đồng's is not found.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ meetingId: string; kind: string }> }) {
  const actor = await requireActor();
  const parsed = z.object({ meetingId: z.string().min(1), kind: z.enum(MEETING_DOCUMENT_KINDS) }).safeParse(await params);
  if (!parsed.success) notFound();
  const { kind } = parsed.data;
  let doc;
  try {
    doc = await app().core.scoring.generateMeetingDocument(actor, parsed.data).catch(orNotFound);
  } catch (err) {
    return new Response(domainMessage(err), { status: 409, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (!doc) notFound();
  return new Response(Buffer.from(doc.bytes), {
    headers: {
      "content-type": DOCX_TYPE,
      "content-disposition": `attachment; filename="van-ban-hop-${kind}.docx"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "cache-control": "no-store",
    },
  });
}
