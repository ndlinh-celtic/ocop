import { Flag, Lock } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * S43 Tổng hợp điểm (L15 HD-04, HD-05; stories 98 to 100), list part: the hồ sơ of the Hội đồng Sẵn sàng chốt, each
 * with its Cờ chênh lệch, for the Chủ tịch and Thư ký. A row opens the comparison table.
 */
export default async function ReadyDossiersPage() {
  const actor = await requireActor();
  const rows = (await app().core.scoring.gradingProgress(actor)).filter((r) => r.state === "member_confirmed");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Tổng hợp điểm</h1>
        <p className="text-sm text-text-2">Hồ sơ Sẵn sàng chốt: đủ phiếu đã xác nhận theo Quy tắc tổng hợp của đợt.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Lock} title="Chưa có hồ sơ Sẵn sàng chốt">
          Hồ sơ hiện ở đây khi số phiếu đã xác nhận đạt số người chấm tối thiểu. Theo dõi ở Tiến độ chấm.
        </EmptyState>
      ) : (
        <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-3 py-2">Mã hồ sơ</th>
                <th className="px-3 py-2">Sản phẩm</th>
                <th className="px-3 py-2">Đợt</th>
                <th className="px-3 py-2">Phiếu đã xác nhận</th>
                <th className="px-3 py-2">Cờ chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.dossierId} className="border-b last:border-0" data-testid="ready-row">
                  <td className="px-3 py-2 font-mono whitespace-nowrap">
                    <Link href={`/hoi-dong/chot-diem/${r.dossierId}`} className="text-brand">
                      {r.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.productName || "(Chưa đặt tên sản phẩm)"}</td>
                  <td className="px-3 py-2">{r.round?.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.confirmed} / {r.graders}
                  </td>
                  <td className="px-3 py-2">
                    {r.flagged ? (
                      <span className="inline-flex items-center gap-1 text-danger">
                        <Flag className="size-4" aria-hidden /> Lệch điểm lớn
                      </span>
                    ) : (
                      <span className="text-text-3">Không</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
