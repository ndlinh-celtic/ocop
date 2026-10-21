import type { ReturnRequestView } from "@ocop/core";
import { formatVnDateTime } from "@/lib/format";

/** Story 59: the đề nghị trả về of a hồ sơ, newest first, as the xã and the Sở see them. */
export function ReturnRequests({ requests }: { requests: ReturnRequestView[] }) {
  if (requests.length === 0) return null;
  return (
    <section className="rounded-lg border bg-surface shadow-card">
      <h2 className="border-b p-4 font-semibold">Đề nghị trả về của xã</h2>
      <ul className="divide-y text-sm">
        {[...requests].reverse().map((r) => (
          <li key={r.id} className="flex flex-col gap-1 px-4 py-3">
            <span className="flex flex-wrap items-center gap-2 text-text-3">
              {formatVnDateTime(r.requestedAt)} · {r.requestedBy.fullName || "Cán bộ xã"}
              {r.pending && <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-medium text-amber">Chờ Sở xem xét</span>}
            </span>
            <span className="whitespace-pre-line">{r.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
