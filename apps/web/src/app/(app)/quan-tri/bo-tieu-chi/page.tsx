import { ListTree } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { formatVnDateTime } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { ImportForm } from "./import-form";
import { formatIsoDate, StatusTag } from "@/components/criteria/status-tag";

export const dynamic = "force-dynamic";

/** S71: Phiên bản tiêu chí, drafts included for Quản trị (L19). */
export default async function CriteriaVersionsPage() {
  const actor = await requireActor();
  const versions = await app().core.criteria.listVersions(actor);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Phiên bản tiêu chí</h1>
      <section className="rounded-lg border bg-surface p-4">
        <h2 className="mb-1 font-medium">Nhập từ tệp</h2>
        <p className="mb-3 text-sm text-text-2">
          Bước nhập chỉ tạo bản nháp. Soát bản nháp (đặc biệt các chỗ trong sheet &ldquo;Cần rà soát&rdquo;) trước khi phát hành.
        </p>
        <ImportForm />
      </section>
      {versions.length === 0 ? (
        <EmptyState icon={ListTree} title="Chưa có phiên bản tiêu chí">
          Nhập tệp bóc tách của văn bản căn cứ hiện hành để tạo bản nháp đầu tiên.
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
                <th className="px-4 py-2">Trạng thái</th>
                <th className="px-4 py-2">Tạo lúc</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/quan-tri/bo-tieu-chi/${v.id}`} className="font-medium text-brand underline-offset-2 hover:underline">
                      {v.legalBasis}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{formatIsoDate(v.issuedOn)}</td>
                  <td className="px-4 py-2">{formatIsoDate(v.effectiveOn)}</td>
                  <td className="px-4 py-2">{v.setCount}</td>
                  <td className="px-4 py-2">
                    <StatusTag status={v.status} />
                  </td>
                  <td className="px-4 py-2">{formatVnDateTime(v.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
