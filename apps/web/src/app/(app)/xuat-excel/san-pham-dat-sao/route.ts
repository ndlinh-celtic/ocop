import { z } from "zod";
import { app } from "@/server/app";
import { attachmentResponse, domainErrorResponse, textResponse } from "@/server/download";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/** Năm cấp and Hạng công nhận as the form on /so/giay-chung-nhan sends them; blank means any. */
const Query = z.object({
  year: z
    .string()
    .regex(/^(\d{4})?$/)
    .optional(),
  star: z.enum(["", "3", "4", "5"]).optional(),
});

/**
 * L22 DC-05 (#91, spec #79 stories 83 to 86): the danh sách sản phẩm đạt sao for the cổng thông tin tỉnh, as Excel.
 * Built on each request and streamed, never stored; the export is audited by the core.
 */
export async function GET(req: Request) {
  const actor = await requireActor();
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return textResponse("Bộ lọc không hợp lệ", 400);
  const { year, star } = parsed.data;
  let file;
  try {
    file = await app().core.results.exportStarList(actor, {
      ...(year ? { year: Number(year) } : {}),
      ...(star ? { star: Number(star) } : {}),
    });
  } catch (err) {
    return domainErrorResponse(err);
  }
  return attachmentResponse(file.bytes, file);
}
