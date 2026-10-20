import { DOSSIER_STATE_LABEL, DOSSIER_STATES, type DossierOverviewRow, type DossierState } from "@ocop/core";
import { FolderOpen } from "lucide-react";
import Link from "next/link";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { EmptyState } from "@/components/empty-state";
import { formatVnDateTime } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

const LIST = "/so/ho-so";

/**
 * Hồ sơ toàn tỉnh (L06, #44, stories 78, 79): every hồ sơ that has reached the province, even after a Sở
 * trả về, with a link to its detail; below, the số liệu tổng hợp of the hồ sơ still at the xã, by xã and
 * state, with no row of a hồ sơ.
 */
export default async function ProvinceDossiersPage() {
  const actor = await requireActor();
  const [dossiers, overview] = await Promise.all([app().core.dossiers.list(actor), app().core.dossiers.provinceOverview(actor)]);
  const { states, wards } = pivot(overview);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Hồ sơ toàn tỉnh</h1>
        <p className="text-sm text-text-2">Hồ sơ UBND xã/phường đã gửi lên tỉnh, kể cả hồ sơ Sở đã trả về.</p>
      </div>

      {dossiers.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Chưa có hồ sơ nào lên tỉnh">
          Hồ sơ xã/phường gửi tỉnh sẽ hiện ở đây.
        </EmptyState>
      ) : (
        <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-4 py-2">Sản phẩm</th>
                <th className="px-4 py-2">Chủ thể</th>
                <th className="px-4 py-2">Bộ tiêu chí</th>
                <th className="px-4 py-2">Lên tỉnh lần đầu</th>
                <th className="px-4 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.map((d) => (
                <tr key={d.id} className="border-b last:border-0" data-testid="dossier-row">
                  <td className="px-4 py-2">
                    <Link href={`${LIST}/${d.id}`} className="font-medium text-brand underline-offset-2 hover:underline">
                      {d.productName || "(Chưa đặt tên sản phẩm)"}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{d.entity.name}</td>
                  <td className="px-4 py-2">{d.criteriaSet.name}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{d.firstForwardedAt ? formatVnDateTime(d.firstForwardedAt) : "—"}</td>
                  <td className="px-4 py-2">
                    <DossierStateTag state={d.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-lg border bg-surface shadow-card">
        <div className="border-b p-4">
          <h2 className="font-semibold">Hồ sơ chưa lên tỉnh theo xã/phường</h2>
          <p className="text-sm text-text-3">Chỉ số liệu tổng hợp; chi tiết hồ sơ do UBND xã/phường quản lý cho đến khi gửi tỉnh.</p>
        </div>
        {wards.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-text-3">Chưa có hồ sơ nào đang ở xã/phường.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="province-overview">
              <thead className="border-b bg-surface-2">
                <tr>
                  <th className="px-4 py-2">Xã/phường</th>
                  {states.map((s) => (
                    <th key={s} className="px-4 py-2 text-right">
                      {DOSSIER_STATE_LABEL[s]}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right">Tổng</th>
                </tr>
              </thead>
              <tbody>
                {wards.map((w) => (
                  <tr key={w.wardId} className="border-b last:border-0">
                    <td className="px-4 py-2">{w.wardName}</td>
                    {states.map((s) => (
                      <td key={s} className="px-4 py-2 text-right tabular-nums">
                        {w.counts.get(s) ?? 0}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-medium tabular-nums">{[...w.counts.values()].reduce((a, b) => a + b, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** The counts as one row per xã and one column per state present, states in lifecycle order. */
function pivot(rows: DossierOverviewRow[]) {
  const present = new Set(rows.map((r) => r.state));
  const states: DossierState[] = DOSSIER_STATES.filter((s) => present.has(s));
  const byWard = new Map<string, { wardId: string; wardName: string; counts: Map<DossierState, number> }>();
  for (const r of rows) {
    const w = byWard.get(r.wardId) ?? { wardId: r.wardId, wardName: r.wardName, counts: new Map() };
    w.counts.set(r.state, r.count);
    byWard.set(r.wardId, w);
  }
  return { states, wards: [...byWard.values()] };
}
