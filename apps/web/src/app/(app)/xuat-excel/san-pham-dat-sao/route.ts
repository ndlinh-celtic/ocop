import { DomainError } from "@ocop/core";
import { z } from "zod";
import { app } from "@/server/app";
import { domainMessage } from "@/server/errors";
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
  if (!parsed.success) return new Response("Bộ lọc không hợp lệ", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  const { year, star } = parsed.data;
  let file;
  try {
    file = await app().core.results.exportStarList(actor, {
      ...(year ? { year: Number(year) } : {}),
      ...(star ? { star: Number(star) } : {}),
    });
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
