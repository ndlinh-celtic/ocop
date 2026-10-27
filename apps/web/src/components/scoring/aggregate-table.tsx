import { Flag, Lock } from "lucide-react";
import type { ConfirmedSheetsView, FullScoresView } from "@ocop/core";
import { formatVnDateTime } from "@/lib/format";

const SHEET = { draft: "Đang chấm", confirmed: "Đã xác nhận", absent: "Vắng", superseded: "Bị thay thế" } as const;

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
/** Points in vi-VN with up to two decimals (averages in thirds show as 26,67). */
export const formatPoints = (n: number) => number.format(n);

function Stars({ n }: { n: number }) {
  return (
    <span className="text-amber">
      <span aria-hidden>{"★".repeat(n)}</span>
      <span className="sr-only">{n} sao</span>
    </span>
  );
}

/**
 * The comparison table of S43 and S63 (L15 HD-04, HD-05; stories 93, 98 to 100): rows are Tiêu chí grouped by Phần,
 * columns each thành viên chấm in force then Tổng hợp; a phiếu not yet confirmed shows its state and no points.
 * The rank panel shows Phần A/B/C, tổng, Hạng sao (computed, never set by hand), unmet Sao tối thiểu and the Cờ chênh lệch.
 * Before Sẵn sàng chốt the Chủ tịch and Thư ký get the phiếu đã xác nhận alone (#68): no Tổng hợp column, no rank panel.
 */
export function AggregateTable({ view }: { view: FullScoresView | ConfirmedSheetsView }) {
  const { graders, criteria, thresholds } = view;
  const aggregate = view.kind === "full" ? view.aggregate : null;
  const cell = new Map(graders.flatMap((g) => (g.lines ?? []).map((l) => [`${g.userId}:${l.criterionId}`, l] as const)));
  const parts = [...new Set(criteria.map((c) => c.partCode))].map((code) => ({
    code,
    total: aggregate?.parts.find((p) => p.code === code)?.total ?? 0,
    criteria: criteria.filter((c) => c.partCode === code),
  }));
  const partTotalOf = (userId: string, partCode: string) =>
    criteria.filter((c) => c.partCode === partCode).reduce((sum, c) => sum + (cell.get(`${userId}:${c.criterionId}`)?.points ?? 0), 0);
  const next = aggregate && ([2, 3, 4, 5] as const).find((s) => aggregate.total < thresholds[s]);
  const locked = view.kind === "full" && view.dossierState !== "member_confirmed";

  return (
    <div className="flex flex-col gap-4">
      {locked && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-brand bg-brand-soft px-4 py-2 text-sm text-brand">
          <Lock className="size-4" aria-hidden /> Điểm của hồ sơ đã chốt; bảng chỉ để xem.
        </p>
      )}
      <div className={aggregate ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]" : ""}>
        <section className="overflow-x-auto rounded-lg border bg-surface shadow-card" aria-label="Bảng so sánh điểm">
          <table className="w-full text-left text-sm" data-testid="aggregate-table">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-3 py-2">Tiêu chí</th>
                {graders.map((g) => (
                  <th key={g.userId} className="px-3 py-2 text-right" title={g.confirmedAt ? `Xác nhận lúc ${formatVnDateTime(g.confirmedAt)}` : undefined}>
                    {g.fullName}
                    {g.state !== "confirmed" && <span className="block text-xs font-normal text-text-3">{g.state ? SHEET[g.state] : "Chưa mở"}</span>}
                  </th>
                ))}
                {aggregate && <th className="px-3 py-2 text-right">Tổng hợp</th>}
              </tr>
            </thead>
            {parts.map((p) => (
              <tbody key={p.code} className="border-b last:border-0">
                {p.criteria.map((c) => (
                  <tr key={c.criterionId} className="border-b border-line/50 align-top">
                    <td className="px-3 py-1.5">
                      <span className="font-mono">{c.code}</span> {c.name} <span className="text-text-3">(tối đa {formatPoints(c.maxPoints)})</span>
                    </td>
                    {graders.map((g) => {
                      const l = cell.get(`${g.userId}:${c.criterionId}`);
                      const note = [l?.comment, l?.adjustReason && `Lý do điều chỉnh: ${l.adjustReason}`].filter(Boolean).join("\n");
                      return (
                        <td key={g.userId} className="px-3 py-1.5 text-right tabular-nums" title={note || undefined}>
                          {g.lines ? formatPoints(l?.points ?? 0) : "—"}
                          {note && <span className="ml-1 text-xs text-info">*</span>}
                        </td>
                      );
                    })}
                    {aggregate && <td className="px-3 py-1.5 text-right font-medium tabular-nums">{formatPoints(aggregate.averages[c.criterionId] ?? 0)}</td>}
                  </tr>
                ))}
                <tr className="bg-surface-2/60 font-medium">
                  <td className="px-3 py-1.5">Tổng Phần {p.code}</td>
                  {graders.map((g) => (
                    <td key={g.userId} className="px-3 py-1.5 text-right tabular-nums">
                      {g.lines ? formatPoints(partTotalOf(g.userId, p.code)) : "—"}
                    </td>
                  ))}
                  {aggregate && <td className="px-3 py-1.5 text-right tabular-nums">{formatPoints(p.total)}</td>}
                </tr>
              </tbody>
            ))}
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="px-3 py-2">Tổng điểm</td>
                {graders.map((g) => (
                  <td key={g.userId} className="px-3 py-2 text-right tabular-nums">
                    {g.total === null ? "—" : formatPoints(g.total)}
                  </td>
                ))}
                {aggregate && (
                  <td className="px-3 py-2 text-right tabular-nums" data-testid="aggregate-total">
                    {formatPoints(aggregate.total)}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
          <p className="px-3 py-2 text-xs text-text-3">
            Dấu * : có nhận xét hoặc lý do điều chỉnh, rê chuột vào ô để xem. Phiếu chưa xác nhận không được tính.
          </p>
        </section>

        {aggregate && view.kind === "full" && (
          <aside className="flex flex-col gap-3 rounded-lg border bg-surface p-4 text-sm shadow-card" aria-label="Gợi ý hạng">
            <h2 className="font-semibold">Gợi ý hạng</h2>
            <p className="text-2xl" data-testid="aggregate-star">
              <Stars n={aggregate.star} /> <span className="text-base text-text-2">{aggregate.star} sao</span>
            </p>
            {aggregate.star < 3 && <p className="text-danger">Dưới 3 sao: không đạt.</p>}
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
              <dt className="text-text-2">Theo Ngưỡng hạng</dt>
              <dd>
                <Stars n={aggregate.byThreshold} />
              </dd>
              <dt className="text-text-2">Theo Sao tối thiểu</dt>
              <dd>
                <Stars n={aggregate.byMinimumStars} />
              </dd>
              <dt className="text-text-2">Ngưỡng hạng</dt>
              <dd>
                {thresholds[2]}/{thresholds[3]}/{thresholds[4]}/{thresholds[5]}
              </dd>
              {next && (
                <>
                  <dt className="text-text-2">Còn thiếu tới {next} sao</dt>
                  <dd>{formatPoints(thresholds[next] - aggregate.total)} điểm</dd>
                </>
              )}
              <dt className="text-text-2">Phiếu được tính</dt>
              <dd>
                {aggregate.sheetCount} (tối thiểu {view.minGraders})
              </dd>
            </dl>
            {aggregate.unmet.length > 0 && (
              <div>
                <h3 className="font-medium">Yêu cầu Sao tối thiểu chưa đạt</h3>
                <ul className="mt-1 flex flex-col gap-1">
                  {aggregate.unmet.map((u) => (
                    <li key={`${u.criterionId}-${u.star}`} className="text-warning">
                      {u.code}: cần {formatPoints(u.required)} điểm để đạt {u.star} sao (trung bình {formatPoints(u.actual)})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p
              className={`flex items-center gap-2 rounded-md px-3 py-2 ${aggregate.flagged ? "bg-danger/10 text-danger" : "bg-surface-2 text-text-2"}`}
              data-testid="deviation-flag"
            >
              <Flag className="size-4" aria-hidden />
              {aggregate.flagged ? "Cờ chênh lệch: " : "Không có cờ chênh lệch: "}
              tổng điểm các phiếu lệch {formatPoints(aggregate.deviation)} (ngưỡng {formatPoints(view.deviationFlagPoints)})
            </p>
            <p className="text-xs text-text-3">Hạng sao tính từ điểm, không sửa tay được.</p>
          </aside>
        )}
      </div>
    </div>
  );
}
