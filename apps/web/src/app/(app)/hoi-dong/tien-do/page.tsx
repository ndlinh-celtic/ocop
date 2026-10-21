import { ListChecks } from "lucide-react";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { EmptyState } from "@/components/empty-state";
import { formatVnDateTime } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

const SHEET = {
  draft: { label: "Đang xem xét", style: "bg-amber-soft text-amber" },
  confirmed: { label: "Đã xác nhận", style: "bg-brand-soft text-brand" },
  absent: { label: "Vắng", style: "bg-surface-2 text-text-3" },
  superseded: { label: "Bị thay thế", style: "bg-surface-2 text-text-3" },
} as const;

/**
 * S42 Tiến độ chấm (L15 HD-04; stories 95 to 97): for the Chủ tịch and Thư ký, every hồ sơ of the Hội đồng between
 * Giao chấm and chốt, with each thành viên chấm's phiếu state and how many are confirmed against the đợt's người
 * chấm tối thiểu. No points appear here before Sẵn sàng chốt is read (#59).
 */
export default async function GradingProgressPage() {
  const actor = await requireActor();
  const rows = await app().core.scoring.gradingProgress(actor);
  const confirmed = rows.reduce((n, r) => n + r.confirmed, 0);
  const graders = rows.reduce((n, r) => n + r.graders, 0);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Tiến độ chấm</h1>
        <p className="text-sm text-text-2">Ai đã xác nhận phiếu, ai chưa, theo từng hồ sơ. Điểm của thành viên không hiện ở đây.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={ListChecks} title="Chưa có hồ sơ đang chấm">
          Hồ sơ sẽ hiện ở đây sau khi Thư ký hội đồng Giao chấm.
        </EmptyState>
      ) : (
        <>
          <section className="rounded-lg border bg-surface p-4 shadow-card" aria-label="Tổng hợp tiến độ">
            <p className="text-sm">
              <b>{confirmed}</b> / {graders} phiếu đã xác nhận · <b>{rows.filter((r) => r.state === "member_confirmed").length}</b> / {rows.length} hồ sơ Sẵn sàng chốt
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-brand" style={{ width: `${graders === 0 ? 0 : Math.round((confirmed / graders) * 100)}%` }} />
            </div>
          </section>
          <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-surface-2">
                <tr>
                  <th className="px-3 py-2">Mã hồ sơ</th>
                  <th className="px-3 py-2">Sản phẩm</th>
                  <th className="px-3 py-2">Đợt</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2">Đã xác nhận</th>
                  <th className="px-3 py-2">Thành viên chấm</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.dossierId} className="border-b align-top last:border-0" data-testid="progress-row">
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{r.code}</td>
                    <td className="px-3 py-2">{r.productName || "(Chưa đặt tên sản phẩm)"}</td>
                    <td className="px-3 py-2">{r.round?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <DossierStateTag state={r.state} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.confirmed} / {r.graders} <span className="text-text-3">(cần {r.minGraders})</span>
                    </td>
                    <td className="px-3 py-2">
                      <ul className="flex flex-wrap gap-1">
                        {r.progress.map((p) => (
                          <li
                            key={p.userId}
                            className={`rounded-full px-2 py-0.5 text-xs ${p.state ? SHEET[p.state].style : "bg-surface-2 text-text-3"}`}
                            title={p.confirmedAt ? `Xác nhận lúc ${formatVnDateTime(p.confirmedAt)}` : undefined}
                          >
                            {p.fullName}: {p.state ? SHEET[p.state].label : "Chưa mở"}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
