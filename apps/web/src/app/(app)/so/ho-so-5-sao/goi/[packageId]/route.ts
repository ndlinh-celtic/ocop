import { notFound } from "next/navigation";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * L17 SO-04 (#89, story 51): the link of a Gói đề nghị 5 sao, as the notice gives it. Each visit issues a fresh
 * pre-signed URL and redirects to it, so the ZIP comes straight from object storage, never through the web server.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ packageId: string }> }) {
  const actor = await requireActor();
  const { packageId } = await params;
  let link;
  try {
    link = await app().core.results.downloadFiveStarPackage(actor, { packageId }).catch(orNotFound);
  } catch (err) {
    return new Response(domainMessage(err), { status: 409, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (!link) notFound();
  return new Response(null, { status: 303, headers: { location: link.url, "cache-control": "no-store" } });
}
