import { app } from "@/server/app";
import { attachmentResponse, domainErrorResponse } from "@/server/download";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/** L16 HD-11 (#84, story 27): the bản nháp of every Giấy chứng nhận of one quyết định, as one ZIP for ký hàng loạt. */
export async function GET(_req: Request, { params }: { params: Promise<{ decisionId: string }> }) {
  const actor = await requireActor();
  const { decisionId } = await params;
  try {
    const drafts = await app().core.results.certificateDrafts(actor, { decisionId });
    return attachmentResponse(drafts.stream, drafts);
  } catch (err) {
    return domainErrorResponse(err);
  }
}
