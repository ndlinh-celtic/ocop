import type { AggregateOnlyView } from "@ocop/core";
import { formatPoints } from "@/components/scoring/aggregate-table";
import { formatVnDateTime } from "@/lib/format";

const REASON_LABEL = { min_star: "Sao tối thiểu chưa đạt", low_ratio: "Điểm trung bình dưới tỷ lệ" } as const;

/**
 * L16 (#80, spec #79 stories 37, 68): the kết quả chốt hiện hành as the Cán bộ Sở sees it, the điểm tổng hợp, điểm theo
 * Phần, Hạng sao, Tiêu chí dưới mức and Nhận xét chung; never a thành viên's phiếu.
 */
export function ProvinceResult({ view, generalComment }: { view: AggregateOnlyView; generalComment: string | null }) {
  const { aggregate } = view;
  const underperforming = view.underperforming ?? [];
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-surface p-4 text-sm shadow-card" data-testid="province-result">
      <h2 className="font-semibold">Kết quả chốt điểm</h2>
      <p className="font-medium">
        {aggregate.star} sao{aggregate.star < 3 && " (không đạt)"}, {formatPoints(aggregate.total)} điểm (
        {aggregate.parts.map((p) => `Phần ${p.code} ${formatPoints(p.total)}`).join(", ")}).
      </p>
      <p className="text-text-2">
        Chốt lúc {formatVnDateTime(view.result.finalizedAt)}
        {view.result.n > 1 && ` (lần ${view.result.n})`}.
      </p>
      <div>
        <p className="font-medium">Nhận xét chung của Hội đồng</p>
        <p className="whitespace-pre-line text-text-2">{generalComment || "Hội đồng chưa viết nhận xét chung."}</p>
      </div>
      <div>
        <p className="font-medium">Tiêu chí dưới mức</p>
        {underperforming.length === 0 ? (
          <p className="text-text-3">Không có tiêu chí dưới mức.</p>
        ) : (
          <table className="mt-1 w-full text-left" data-testid="underperforming">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-3 py-1.5">Tiêu chí</th>
                <th className="px-3 py-1.5">Điểm trung bình / tối đa</th>
                <th className="px-3 py-1.5">Lý do</th>
              </tr>
            </thead>
            <tbody>
              {underperforming.map((c) => (
                <tr key={c.criterionId} className="border-b align-top last:border-0">
                  <td className="px-3 py-1.5">
                    <b>{c.code}</b> {c.name}
                  </td>
                  <td className="px-3 py-1.5">
                    {formatPoints(c.average)} / {formatPoints(c.maxPoints)}
                  </td>
                  <td className="px-3 py-1.5">{c.reasons.map((r) => REASON_LABEL[r]).join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
