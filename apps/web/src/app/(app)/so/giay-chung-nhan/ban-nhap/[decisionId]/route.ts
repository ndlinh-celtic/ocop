import { DomainError } from "@ocop/core";
import { zipFiles } from "@ocop/infra";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/** L16 HD-11 (#84, story 27): the bản nháp of every Giấy chứng nhận of one quyết định, as one ZIP for ký hàng loạt. */
export async function GET(_req: Request, { params }: { params: Promise<{ decisionId: string }> }) {
  const actor = await requireActor();
  const { decisionId } = await params;
  let drafts;
  try {
    drafts = await app().core.results.certificateDrafts(actor, { decisionId });
  } catch (err) {
    const status = err instanceof DomainError ? (err.code === "forbidden" ? 403 : err.code === "not_found" ? 404 : 409) : 500;
    return new Response(domainMessage(err), { status, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response(Buffer.from(zipFiles(drafts.files)), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${drafts.fileName.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(drafts.fileName)}`,
      "cache-control": "no-store",
    },
  });
}
