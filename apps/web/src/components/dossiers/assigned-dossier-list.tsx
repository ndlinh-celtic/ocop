import type { DossierSummary } from "@ocop/core";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { formatVnDateTime } from "@/lib/format";
import { DossierStateTag } from "./dossier-state-tag";

/**
 * The hồ sơ a thành viên chấm or Thành viên Tổ tư vấn has a Phân công in force on (L09 HD-06, stories 41, 78,
 * 79), in its minimal form: what the DataScope `assigned` lets them see, from Giao chấm on.
 */
export function AssignedDossierList({ dossiers, empty }: { dossiers: DossierSummary[]; empty: string }) {
  if (dossiers.length === 0) {
    return (
      <EmptyState icon={ClipboardList} title="Chưa có hồ sơ được giao">
        {empty}
      </EmptyState>
    );
  }
  return (
    <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-surface-2">
          <tr>
            <th className="px-3 py-2">Mã hồ sơ</th>
            <th className="px-3 py-2">Sản phẩm</th>
            <th className="px-3 py-2">Nhóm</th>
            <th className="px-3 py-2">Đợt</th>
            <th className="px-3 py-2">Trạng thái</th>
            <th className="px-3 py-2">Giao chấm</th>
          </tr>
        </thead>
        <tbody>
          {dossiers.map((d) => (
            <tr key={d.id} className="border-b last:border-0" data-testid="assigned-dossier">
              <td className="px-3 py-2 font-mono whitespace-nowrap">{d.code}</td>
              <td className="px-3 py-2">
                <div className="font-medium">{d.productName || "(Chưa đặt tên sản phẩm)"}</div>
                <div className="text-xs text-text-3">{d.entity.name}</div>
              </td>
              <td className="px-3 py-2">{d.productGroup?.name ?? "—"}</td>
              <td className="px-3 py-2">{d.round?.name ?? "—"}</td>
              <td className="px-3 py-2">
                <DossierStateTag state={d.state} />
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-text-2">{d.gradingStartedAt ? formatVnDateTime(d.gradingStartedAt) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
