import type { VersionDetail } from "@ocop/core";
import Link from "next/link";
import { formatVnDateTime } from "@/lib/format";
import { formatIsoDate } from "./status-tag";

/** S72 body: dates, Ngưỡng hạng and Cây phân loại of a Phiên bản tiêu chí (L19); `setHref` links each Bộ tiêu chí. */
export function VersionOverview({ version, setHref }: { version: VersionDetail; setHref: (setId: string) => string }) {
  const setCount = version.productGroups.reduce((n, g) => n + g.subgroups.reduce((m, s) => m + s.sets.length, 0), 0);
  return (
    <>
      <section className="grid gap-4 rounded-lg border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Ngày ban hành" value={formatIsoDate(version.issuedOn)} />
        <Fact label="Ngày hiệu lực (ghi nhận)" value={formatIsoDate(version.effectiveOn)} />
        <Fact label="Tạo lúc" value={formatVnDateTime(version.createdAt)} />
        <Fact label="Phát hành" value={version.publishedAt ? formatVnDateTime(version.publishedAt) : "Chưa phát hành"} />
      </section>
      <section className="rounded-lg border bg-surface p-4">
        <h2 className="mb-3 font-medium">Ngưỡng hạng</h2>
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
              <h3 className="font-semibold">{g.name}</h3>
              <ol className="mt-2 flex flex-col gap-2 border-l border-line-strong pl-4">
                {g.subgroups.map((s) => (
                  <li key={s.id}>
                    <p className="text-sm font-medium text-text-2">{s.name}</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {s.sets.map((b) => (
                        <li key={b.id} className="text-sm">
                          <Link href={setHref(b.id)} className="text-brand underline-offset-2 hover:underline">
                            Bộ {b.code}. {b.name}
                          </Link>{" "}
                          <span className="text-text-3">
                            · {b.criterionCount} tiêu chí · {b.totalPoints} điểm
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
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
