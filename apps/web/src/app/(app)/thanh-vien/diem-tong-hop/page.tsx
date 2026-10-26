import { Table2 } from "lucide-react";
import Link from "next/link";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { EmptyState } from "@/components/empty-state";
import { formatPoints } from "@/components/scoring/aggregate-table";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * S63 Điểm tổng hợp (L15 TV-08; story 93), list part: the hồ sơ of the thành viên whose read model is `full`, i.e. their
 * phiếu is confirmed and the hồ sơ Sẵn sàng chốt or later. Others do not appear, so nobody's points leak. The list shows
 * the tổng hợp alone, no phiếu, so opening it is no personal data access (#73); the detail page is.
 */
export default async function MemberAggregatesPage() {
  const actor = await requireActor();
  const rows = await app().core.scoring.aggregateSummaries(actor);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Điểm tổng hợp</h1>
        <p className="text-sm text-text-2">Phiếu từng người và điểm tổng hợp của hồ sơ Sẵn sàng chốt mà anh/chị đã xác nhận phiếu, để họp thống nhất.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Table2} title="Chưa có hồ sơ để xem điểm tổng hợp">
          Điểm của các thành viên khác sẽ hiển thị khi anh/chị đã xác nhận phiếu và hồ sơ đủ phiếu xác nhận.
        </EmptyState>
      ) : (
        <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-3 py-2">Mã hồ sơ</th>
                <th className="px-3 py-2">Sản phẩm</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2 text-right">Tổng hợp</th>
                <th className="px-3 py-2">Hạng sao</th>
                <th className="px-3 py-2">Cờ chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.dossierId} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono whitespace-nowrap">
                    <Link href={`/thanh-vien/diem-tong-hop/${r.dossierId}`} className="text-brand">
                      {r.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.productName || "(Chưa đặt tên sản phẩm)"}</td>
                  <td className="px-3 py-2">
                    <DossierStateTag state={r.state} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatPoints(r.total)}</td>
                  <td className="px-3 py-2 text-amber">{"★".repeat(r.star)}</td>
                  <td className="px-3 py-2">{r.flagged ? <span className="text-danger">Lệch điểm lớn</span> : <span className="text-text-3">Không</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
