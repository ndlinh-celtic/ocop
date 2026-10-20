import type { VersionDetail } from "@ocop/core";
import Link from "next/link";
import { formatVnDateTime } from "@/lib/format";
import type { EditSlot } from "./edit-target";
import { formatIsoDate } from "./status-tag";

/**
 * S72 body: dates, Ngưỡng hạng and Cây phân loại of a Phiên bản tiêu chí (L19); `setHref` links each Bộ tiêu chí.
 * `edit` adds the edit controls of a draft (L19 AD-03).
 */
export function VersionOverview({ version, setHref, edit }: { version: VersionDetail; setHref: (setId: string) => string; edit?: EditSlot }) {
  const setCount = version.productGroups.reduce((n, g) => n + g.subgroups.reduce((m, s) => m + s.sets.length, 0), 0);
  return (
    <>
      <section className="grid gap-4 rounded-lg border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Ngày ban hành" value={formatIsoDate(version.issuedOn)} />
        <Fact label="Ngày hiệu lực (ghi nhận)" value={formatIsoDate(version.effectiveOn)} />
        <Fact label="Tạo lúc" value={formatVnDateTime(version.createdAt)} />
        <Fact label="Phát hành" value={version.publishedAt ? formatVnDateTime(version.publishedAt) : "Chưa phát hành"} />
        {edit && (
          <div className="sm:col-span-2 lg:col-span-4">
            {edit({
              node: "version",
              label: "Văn bản căn cứ và ngày",
              values: { legalBasis: version.legalBasis, issuedOn: version.issuedOn, effectiveOn: version.effectiveOn },
            })}
          </div>
        )}
      </section>
      <section className="rounded-lg border bg-surface p-4">
        <h2 className="mb-3 flex items-center gap-2 font-medium">
          Ngưỡng hạng
          {edit?.({ node: "thresholds", label: "Ngưỡng hạng", values: { 2: version.thresholds[2], 3: version.thresholds[3], 4: version.thresholds[4], 5: version.thresholds[5] } })}
        </h2>
        <ul className="flex flex-wrap gap-3 text-sm">
          {([2, 3, 4, 5] as const).map((stars) => (
            <li key={stars} className="rounded-md border border-line-strong px-3 py-2">
              <span className="text-amber" aria-hidden>
                {"★".repeat(stars)}
              </span>{" "}
              <span className="sr-only">{stars} sao</span>từ <b>{version.thresholds[stars]}</b> điểm
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-lg border bg-surface">
        <h2 className="border-b px-4 py-3 font-medium">
          Cây phân loại <span className="font-normal text-text-3">({version.productGroups.length} nhóm sản phẩm, {setCount} bộ tiêu chí)</span>
        </h2>
        <ol className="flex flex-col divide-y">
          {version.productGroups.map((g) => (
            <li key={g.id} className="px-4 py-3">
              <h3 className="flex items-center gap-2 font-semibold">
                {g.name}
                {edit?.({ node: "productGroup", id: g.id, label: `Nhóm sản phẩm ${g.name}`, values: { name: g.name } })}
              </h3>
              <ol className="mt-2 flex flex-col gap-2 border-l border-line-strong pl-4">
                {g.subgroups.map((s) => (
                  <li key={s.id}>
                    <p className="flex items-center gap-2 text-sm font-medium text-text-2">
                      {s.name}
                      {edit?.({ node: "subgroup", id: s.id, label: `Phân nhóm ${s.name}`, values: { name: s.name } })}
                    </p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {s.sets.map((b) => (
                        <li key={b.id} className="text-sm">
                          <Link href={setHref(b.id)} className="text-brand underline-offset-2 hover:underline">
                            Bộ {b.code}. {b.name}
                          </Link>{" "}
                          <span className="text-text-3">
                            · {b.criterionCount} tiêu chí · {b.totalPoints} điểm
                          </span>{" "}
                          {edit?.({ node: "set", id: b.id, label: `Bộ ${b.code}`, values: { name: b.name, totalPoints: b.totalPoints } })}
                        </li>
                      ))}
                      {edit && <li>{edit({ add: "set", parent: { node: "subgroup", id: s.id }, label: "Thêm bộ tiêu chí" })}</li>}
                    </ul>
                  </li>
                ))}
                {edit && <li>{edit({ add: "subgroup", parent: { node: "productGroup", id: g.id }, label: "Thêm phân nhóm" })}</li>}
              </ol>
            </li>
          ))}
        </ol>
        {edit && <div className="border-t px-4 py-3">{edit({ add: "productGroup", label: "Thêm nhóm sản phẩm" })}</div>}
      </section>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-text-3">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
