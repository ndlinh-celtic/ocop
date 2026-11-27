import { DOSSIER_STATE_LABEL, DOSSIER_STATES, type DossierListInput, type DossierState } from "@ocop/core";
import { FolderOpen } from "lucide-react";
import Link from "next/link";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { ExportExcelLink } from "@/components/dossiers/export-excel-link";
import { EmptyState } from "@/components/empty-state";
import { formatVnDateTime } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

const LIST = "/xa/ho-so";

/** The states a hồ sơ can be in once at the xã; a Nháp never is. */
const WARD_STATES: DossierState[] = DOSSIER_STATES.filter((s) => s !== "draft");

const TABS = [
  { key: "", label: "Tất cả" },
  { key: "cho-tiep-nhan", label: "Chờ tiếp nhận" },
  { key: "cua-toi", label: "Tôi phụ trách" },
  { key: "cho-dot-sau", label: "Chờ đợt sau" },
] as const;

function inputOf(loc: string | undefined, state: string | undefined): DossierListInput {
  const valid = WARD_STATES.find((s) => s === state);
  return {
    ...(loc === "cho-tiep-nhan"
      ? { filter: "awaiting_receipt" as const }
      : loc === "cua-toi"
        ? { filter: "mine" as const }
        : loc === "cho-dot-sau"
          ? { filter: "awaiting_next_round" as const }
          : {}),
    ...(valid ? { state: valid } : {}),
  };
}

/**
 * S20 Hồ sơ tại xã (L05 XA-01, stories 39, 43, 68): every hồ sơ whose xã is the Cán bộ xã's, whoever is
 * its Cán bộ phụ trách, filtered to Chờ tiếp nhận, của tôi, Chờ đợt sau, or one state.
 */
export default async function WardDossiersPage({ searchParams }: { searchParams: Promise<{ loc?: string; "trang-thai"?: string }> }) {
  const actor = await requireActor();
  const { loc, "trang-thai": state } = await searchParams;
  const input = inputOf(loc, state);
  const dossiers = await app().core.dossiers.list(actor, input);
  const hrefOf = (nextLoc: string, nextState: string | undefined) => {
    const q = new URLSearchParams();
    if (nextLoc) q.set("loc", nextLoc);
    if (nextState) q.set("trang-thai", nextState);
    const s = q.toString();
    return s ? `${LIST}?${s}` : LIST;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Hồ sơ tại xã</h1>
          <p className="text-sm text-text-2">Hồ sơ Chủ thể đã nộp về xã/phường bạn phụ trách.</p>
        </div>
        {/* #90: the list as filtered below (story 80). */}
        <ExportExcelLink input={input} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Lọc hồ sơ" className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const active = (loc ?? "") === tab.key;
            return (
              <Link
                key={tab.key}
                href={hrefOf(tab.key, input.state)}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-1 text-sm ${active ? "bg-brand text-brand-ink" : "border border-line-strong"}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <form method="get" action={LIST} className="flex items-center gap-2 text-sm">
          {loc && <input type="hidden" name="loc" value={loc} />}
          <label htmlFor="trang-thai">Trạng thái</label>
          <select id="trang-thai" name="trang-thai" defaultValue={input.state ?? ""} className="rounded-lg border border-line-strong bg-surface px-2 py-1">
            <option value="">Mọi trạng thái</option>
            {WARD_STATES.map((s) => (
              <option key={s} value={s}>
                {DOSSIER_STATE_LABEL[s]}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg border border-line-strong px-3 py-1">
            Lọc
          </button>
        </form>
      </div>

      {dossiers.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Không có hồ sơ nào">
          {input.filter === "awaiting_receipt"
            ? "Không còn hồ sơ nào chờ tiếp nhận."
            : input.filter === "awaiting_next_round"
              ? "Không có hồ sơ nào quá Hạn gửi tỉnh của đợt."
              : "Hồ sơ Chủ thể nộp về xã sẽ hiện ở đây."}
        </EmptyState>
      ) : (
        <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-4 py-2">Sản phẩm</th>
                <th className="px-4 py-2">Chủ thể</th>
                <th className="px-4 py-2">Bộ tiêu chí</th>
                <th className="px-4 py-2">Ngày nộp</th>
                <th className="px-4 py-2">Trạng thái</th>
                <th className="px-4 py-2">Cán bộ phụ trách</th>
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
                  <td className="px-4 py-2 whitespace-nowrap">{d.submittedAt ? formatVnDateTime(d.submittedAt) : "—"}</td>
                  <td className="px-4 py-2">
                    <span className="flex flex-wrap items-center gap-1">
                      <DossierStateTag state={d.state} />
                      {d.state === "submitted_to_ward" && !d.receivedAt && (
                        <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber">Chờ tiếp nhận</span>
                      )}
                      {d.awaitingNextRound && (
                        <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber">Chờ đợt sau</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2">{d.handler?.fullName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
