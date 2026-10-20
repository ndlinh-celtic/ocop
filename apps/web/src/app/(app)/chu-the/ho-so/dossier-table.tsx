import type { DossierSummary } from "@ocop/core";
import Link from "next/link";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { formatVnDateTime } from "@/lib/format";

/** The hồ sơ of one Chủ thể, newest first, each linking to its page under `home`. */
export function DossierTable({ dossiers, home }: { dossiers: DossierSummary[]; home: string }) {
  return (
    <section className="overflow-x-auto rounded-lg border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-surface-2">
          <tr>
            <th className="px-4 py-2">Sản phẩm</th>
            <th className="px-4 py-2">Bộ tiêu chí</th>
            <th className="px-4 py-2">Trạng thái</th>
            <th className="px-4 py-2">Cập nhật</th>
          </tr>
        </thead>
        <tbody>
          {dossiers.map((d) => (
            <tr key={d.id} className="border-b last:border-0" data-testid="dossier-row">
              <td className="px-4 py-2">
                <Link href={`${home}/${d.id}`} className="font-medium text-brand underline-offset-2 hover:underline">
                  {d.productName || "(Chưa đặt tên sản phẩm)"}
                </Link>
              </td>
              <td className="px-4 py-2">
                {d.criteriaSet.name}
                <span className="block text-xs text-text-3">{d.criteriaVersion.legalBasis}</span>
              </td>
              <td className="px-4 py-2">
                <DossierStateTag state={d.state} />
              </td>
              <td className="px-4 py-2 whitespace-nowrap">{formatVnDateTime(d.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
