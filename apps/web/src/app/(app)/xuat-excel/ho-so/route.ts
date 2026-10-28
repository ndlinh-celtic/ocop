import { DomainError, type DossierListInput } from "@ocop/core";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/** The bộ lọc of a danh sách hồ sơ, as `exportHref` writes it; the core ignores a state or id it does not know. */
const Query = z.object({
  filter: z.enum(["awaiting_receipt", "mine", "awaiting_next_round", "awaiting_province_receipt", "advisory_return_requested"]).optional(),
  state: z.string().optional(),
  roundId: z.string().optional(),
  wardId: z.string().optional(),
  productGroupId: z.string().optional(),
});

/**
 * L22 DC-05 (#90, spec #79 stories 80 to 87): the danh sách hồ sơ the user sees, with the bộ lọc on screen, as Excel.
 * Built on each request and streamed, never stored; the export is audited by the core.
 */
export async function GET(req: Request) {
  const actor = await requireActor();
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return new Response("Bộ lọc không hợp lệ", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  let file;
  try {
    file = await app().core.dossiers.exportDossiers(actor, parsed.data as DossierListInput);
  } catch (err) {
    const status = err instanceof DomainError && err.code === "forbidden" ? 403 : 409;
    return new Response(domainMessage(err), { status, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response(Buffer.from(file.bytes), {
    headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="${file.fileName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "cache-control": "no-store",
    },
  });
}
