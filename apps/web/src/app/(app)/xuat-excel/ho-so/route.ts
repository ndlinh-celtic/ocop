import type { DossierListInput } from "@ocop/core";
import { z } from "zod";
import { app } from "@/server/app";
import { attachmentResponse, domainErrorResponse, textResponse } from "@/server/download";
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
  if (!parsed.success) return textResponse("Bộ lọc không hợp lệ", 400);
  let file;
  try {
    file = await app().core.dossiers.exportDossiers(actor, parsed.data as DossierListInput);
  } catch (err) {
    return domainErrorResponse(err);
  }
  return attachmentResponse(file.bytes, file);
}
