import { ListTree } from "lucide-react";
import Link from "next/link";
import { formatIsoDate } from "@/components/criteria/status-tag";
import { EmptyState } from "@/components/empty-state";
import { formatVnDateTime } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/** Published Phiên bản tiêu chí, read-only for every signed-in Người dùng (L19, spec #16 story 30). */
export default async function PublishedVersionsPage() {
  const actor = await requireActor();
  const versions = (await app().core.criteria.listVersions(actor)).filter((v) => v.status === "published");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Bộ tiêu chí</h1>
      {versions.length === 0 ? (
        <EmptyState icon={ListTree} title="Chưa có phiên bản tiêu chí nào được phát hành">
          Quản trị phát hành phiên bản tiêu chí theo văn bản căn cứ; khi đó các Bộ tiêu chí hiện ở đây.
        </EmptyState>
      ) : (
        <section className="overflow-x-auto rounded-lg border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-4 py-2">Văn bản căn cứ</th>
                <th className="px-4 py-2">Ngày ban hành</th>
                <th className="px-4 py-2">Ngày hiệu lực</th>
                <th className="px-4 py-2">Số bộ tiêu chí</th>
                <th className="px-4 py-2">Phát hành lúc</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/tieu-chi/${v.id}`} className="font-medium text-brand underline-offset-2 hover:underline">
                      {v.legalBasis}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{formatIsoDate(v.issuedOn)}</td>
                  <td className="px-4 py-2">{formatIsoDate(v.effectiveOn)}</td>
                  <td className="px-4 py-2">{v.setCount}</td>
                  <td className="px-4 py-2">{v.publishedAt ? formatVnDateTime(v.publishedAt) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
