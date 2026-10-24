import { can } from "@ocop/core";
import { Users } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { formatIsoDate } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { CouncilForm } from "./council-form";

export const dynamic = "force-dynamic";

/** S40 (L09 HD-01): the Hội đồng recorded by Cán bộ Sở, and the form to record a new one. */
export default async function CouncilsPage() {
  const actor = await requireActor();
  const councils = await app().core.councils.list(actor);
  const manage = can(actor, "council.manage");
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Hội đồng</h1>
      {councils.length === 0 ? (
        <EmptyState icon={Users} title="Chưa có hội đồng">
          Ghi nhận hội đồng theo quyết định thành lập của Chủ tịch UBND tỉnh. Sau đó Quản trị cấp Phân vai cho từng thành viên.
        </EmptyState>
      ) : (
        <section className="overflow-x-auto rounded-lg border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-4 py-2">Tên hội đồng</th>
                <th className="px-4 py-2">Quyết định thành lập</th>
                <th className="px-4 py-2">Ngày quyết định</th>
              </tr>
            </thead>
            <tbody>
              {councils.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/so/hoi-dong/${c.id}`} className="font-medium text-brand underline-offset-2 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{c.decisionNumber}</td>
                  <td className="px-4 py-2">{formatIsoDate(c.decisionDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {manage && (
        <section className="rounded-lg border bg-surface p-4">
          <h2 className="mb-3 font-medium">Ghi nhận hội đồng</h2>
          <CouncilForm />
        </section>
      )}
    </div>
  );
}
