import type { ReturnRequestView } from "@ocop/core";
import { formatVnDateTime } from "@/lib/format";

/**
 * Story 59: the đề nghị trả về of a hồ sơ, newest first, as the xã and the Sở see them; with `from` "advisory",
 * those of the Tổ tư vấn (#57 story 52), as the Sở and the Tổ tư vấn see them.
 */
export function ReturnRequests({ requests, from = "ward" }: { requests: ReturnRequestView[]; from?: "ward" | "advisory" }) {
  if (requests.length === 0) return null;
  return (
    <section className="rounded-lg border bg-surface shadow-card">
      <h2 className="border-b p-4 font-semibold">{from === "ward" ? "Đề nghị trả về của xã" : "Đề nghị trả về xã của Tổ tư vấn"}</h2>
      <ul className="divide-y text-sm">
        {[...requests].reverse().map((r) => (
          <li key={r.id} className="flex flex-col gap-1 px-4 py-3">
            <span className="flex flex-wrap items-center gap-2 text-text-3">
              {formatVnDateTime(r.requestedAt)} · {r.requestedBy.fullName || (from === "ward" ? "Cán bộ xã" : "Tổ tư vấn")}
              {r.pending && <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-medium text-amber">Chờ Sở xem xét</span>}
            </span>
            <span className="whitespace-pre-line">{r.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
