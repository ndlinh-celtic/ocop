import { can, ENTITY_KIND_LABEL } from "@ocop/core";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { formatVnDate } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * L01 (story 77): the Chủ thể đăng ký ở xã của Cán bộ xã, and those with a hồ sơ now in the xã; the xã is
 * the Phạm vi of the Vai trò đang dùng.
 */
export default async function WardEntitiesPage() {
  const actor = await requireActor();
  const entities = await app().core.entities.listEntities(actor);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Chủ thể của xã</h1>
          <p className="text-sm text-text-2">Các Chủ thể đăng ký ở xã/phường bạn phụ trách, và Chủ thể có hồ sơ đang ở xã.</p>
        </div>
        {can(actor, "entity.create") && (
          <Link href="/xa/chu-the/tao-moi" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink">
            <Plus className="size-4" aria-hidden />
            Tạo Chủ thể
          </Link>
        )}
      </div>

      {entities.length === 0 ? (
        <EmptyState icon={Building2} title="Chưa có Chủ thể nào">
          Chủ thể tự đăng ký hoặc do cán bộ xã tạo sẽ hiện ở đây.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-4 py-2">Tên</th>
                <th className="px-4 py-2">Loại tổ chức</th>
                <th className="px-4 py-2">Mã số thuế / số định danh</th>
                <th className="px-4 py-2">Người đại diện</th>
                <th className="px-4 py-2">Đăng ký ngày</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.id} className="border-b last:border-0" data-testid="entity-row">
                  <td className="px-4 py-2">
                    <Link href={`/xa/chu-the/${e.id}`} className="font-medium text-brand">
                      {e.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{ENTITY_KIND_LABEL[e.kind]}</td>
                  <td className="px-4 py-2">{e.identifier}</td>
                  <td className="px-4 py-2">{e.representativeName}</td>
                  <td className="px-4 py-2">{formatVnDate(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
