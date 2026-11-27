import { DOSSIER_STATE_LABEL, DOSSIER_STATES, type DossierListInput, type DossierOverviewRow, type DossierState } from "@ocop/core";
import { FolderOpen } from "lucide-react";
import Link from "next/link";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { ExportExcelLink } from "@/components/dossiers/export-excel-link";
import { EmptyState } from "@/components/empty-state";
import { formatVnDateTime } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

const LIST = "/so/ho-so";

/** The states a hồ sơ can be in once it has reached the province. */
const PROVINCE_STATES: DossierState[] = DOSSIER_STATES.filter((s) => !["draft", "withdrawn"].includes(s));

interface Search {
  loc?: string;
  "trang-thai"?: string;
  dot?: string;
  xa?: string;
  nhom?: string;
}

function inputOf(q: Search): DossierListInput {
  const state = PROVINCE_STATES.find((s) => s === q["trang-thai"]);
  return {
    ...(q.loc === "cho-tiep-nhan" ? { filter: "awaiting_province_receipt" as const } : {}),
    ...(q.loc === "de-nghi-tra-ve" ? { filter: "advisory_return_requested" as const } : {}),
    ...(state ? { state } : {}),
    ...(q.dot ? { roundId: q.dot } : {}),
    ...(q.xa ? { wardId: q.xa } : {}),
    ...(q.nhom ? { productGroupId: q.nhom } : {}),
  };
}

const selectClass = "rounded-lg border border-line-strong bg-surface px-2 py-1";

/**
 * S32 Hồ sơ toàn tỉnh (L06 #44, L08 #51, stories 13, 19, 78, 79): every hồ sơ that has reached the
 * province, even after a Sở trả về, with its mã; "Chờ tiếp nhận" narrows to those Đã chuyển tỉnh not yet
 * Tiếp nhận tại tỉnh in this lượt gửi tỉnh, "Tổ tư vấn đề nghị trả về" to those in Tổ tư vấn thẩm định with a
 * pending đề nghị (#57 story 52), and the list narrows by đợt, xã, Nhóm sản phẩm and state.
 * Below, the số liệu tổng hợp of the hồ sơ still at the xã, by xã and state, with no row of a hồ sơ.
 */
export default async function ProvinceDossiersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requireActor();
  const q = await searchParams;
  const input = inputOf(q);
  const [dossiers, all, overview, rounds, wardList, advisoryAsked] = await Promise.all([
    app().core.dossiers.list(actor, input),
    app().core.dossiers.list(actor),
    app().core.dossiers.provinceOverview(actor),
    app().core.rounds.listRounds(actor),
    app().core.org.listWards(),
    app().core.dossiers.list(actor, { filter: "advisory_return_requested" }),
  ]);
  const { states, wards } = pivot(overview);
  // Nhóm sản phẩm are those of the hồ sơ at the province; each Phiên bản tiêu chí has its own.
  const groups = [...new Map(all.flatMap((d) => (d.productGroup ? [[d.productGroup.id, d.productGroup.name] as const] : []))).entries()];
  const awaiting = all.filter((d) => d.state === "forwarded_to_province" && !d.provinceReceivedAt).length;
  const hrefOf = (loc: string) => {
    const next = new URLSearchParams(Object.entries(q).filter(([k, v]) => k !== "loc" && typeof v === "string" && v !== ""));
    if (loc) next.set("loc", loc);
    const s = next.toString();
    return s ? `${LIST}?${s}` : LIST;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Hồ sơ toàn tỉnh</h1>
          <p className="text-sm text-text-2">Hồ sơ UBND xã/phường đã gửi lên tỉnh, kể cả hồ sơ Sở đã trả về.</p>
        </div>
        {/* #90: the list as filtered below, with điểm tổng hợp and Hạng sao of the hồ sơ đã chốt. */}
        <ExportExcelLink input={input} />
      </div>

      <div className="flex flex-col gap-3">
        <nav aria-label="Lọc hồ sơ" className="flex flex-wrap gap-2">
          {[
            { key: "", label: "Tất cả" },
            { key: "cho-tiep-nhan", label: `Chờ tiếp nhận (${awaiting})` },
            { key: "de-nghi-tra-ve", label: `Tổ tư vấn đề nghị trả về (${advisoryAsked.length})` },
          ].map((tab) => {
            const active = (q.loc ?? "") === tab.key;
            return (
              <Link
                key={tab.key}
                href={hrefOf(tab.key)}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-1 text-sm ${active ? "bg-brand text-brand-ink" : "border border-line-strong"}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <form method="get" action={LIST} className="flex flex-wrap items-end gap-3 text-sm">
          {q.loc && <input type="hidden" name="loc" value={q.loc} />}
          <label className="flex flex-col gap-1">
            Đợt
            <select name="dot" defaultValue={q.dot ?? ""} className={selectClass}>
              <option value="">Mọi đợt</option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Xã/phường
            <select name="xa" defaultValue={q.xa ?? ""} className={selectClass}>
              <option value="">Mọi xã/phường</option>
              {wardList.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Nhóm sản phẩm
            <select name="nhom" defaultValue={q.nhom ?? ""} className={selectClass}>
              <option value="">Mọi nhóm</option>
              {groups.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Trạng thái
            <select name="trang-thai" defaultValue={input.state ?? ""} className={selectClass}>
              <option value="">Mọi trạng thái</option>
              {PROVINCE_STATES.map((s) => (
                <option key={s} value={s}>
                  {DOSSIER_STATE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-lg border border-line-strong px-3 py-1">
            Lọc
          </button>
        </form>
      </div>

      {dossiers.length === 0 ? (
        <EmptyState icon={FolderOpen} title={all.length === 0 ? "Chưa có hồ sơ nào lên tỉnh" : "Không có hồ sơ nào khớp bộ lọc"}>
          {input.filter === "awaiting_province_receipt"
            ? "Không còn hồ sơ nào chờ tiếp nhận tại tỉnh."
            : input.filter === "advisory_return_requested"
              ? "Không có đề nghị trả về nào của Tổ tư vấn đang chờ Sở xem xét."
              : "Hồ sơ xã/phường gửi tỉnh sẽ hiện ở đây."}
        </EmptyState>
      ) : (
        <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-4 py-2">Mã hồ sơ</th>
                <th className="px-4 py-2">Sản phẩm</th>
                <th className="px-4 py-2">Chủ thể</th>
                <th className="px-4 py-2">Xã/phường</th>
                <th className="px-4 py-2">Nhóm sản phẩm</th>
                <th className="px-4 py-2">Đợt</th>
                <th className="px-4 py-2">Lên tỉnh lần đầu</th>
                <th className="px-4 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.map((d) => (
                <tr key={d.id} className="border-b last:border-0" data-testid="dossier-row">
                  <td className="px-4 py-2 font-mono whitespace-nowrap">{d.code}</td>
                  <td className="px-4 py-2">
                    <Link href={`${LIST}/${d.id}`} className="font-medium text-brand underline-offset-2 hover:underline">
                      {d.productName || "(Chưa đặt tên sản phẩm)"}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{d.entity.name}</td>
                  <td className="px-4 py-2">{d.ward?.name ?? "—"}</td>
                  <td className="px-4 py-2">{d.productGroup?.name ?? "—"}</td>
                  <td className="px-4 py-2">{d.round?.name ?? "—"}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{d.firstForwardedAt ? formatVnDateTime(d.firstForwardedAt) : "—"}</td>
                  <td className="px-4 py-2">
                    <span className="flex flex-wrap items-center gap-1">
                      <DossierStateTag state={d.state} />
                      {d.state === "forwarded_to_province" &&
                        (d.provinceReceivedAt ? (
                          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium whitespace-nowrap text-brand">Đã tiếp nhận</span>
                        ) : (
                          <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber">Chờ tiếp nhận</span>
                        ))}
                    </span>
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
