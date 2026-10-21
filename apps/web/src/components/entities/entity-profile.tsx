import { ENTITY_KIND_LABEL, type EntityView } from "@ocop/core";
import type { ReactNode } from "react";
import { formatVnDate } from "@/lib/format";

/**
 * "Thông tin tổ chức" of a Chủ thể (L01 CT-01): what it registered with. `identifier` replaces the plain
 * identifier (masked for anyone but the Chủ thể), e.g. with a control that reveals the full số định danh
 * to a Cán bộ xã.
 */
export function EntityProfile({ entity, email, identifier, children }: { entity: EntityView; email?: string; identifier?: ReactNode; children?: ReactNode }) {
  const household = entity.kind === "household";
  const facts: [string, ReactNode][] = [
    ["Loại tổ chức", ENTITY_KIND_LABEL[entity.kind]],
    [household ? "Số định danh cá nhân của chủ hộ" : "Mã số thuế", identifier ?? entity.identifier],
    ["Xã/phường đăng ký", entity.ward.name],
    ["Địa chỉ", entity.address],
    ["Người đại diện", entity.representativeName],
    ["Số điện thoại", entity.phone],
    ...(email ? ([["Email đăng nhập", email]] as [string, string][]) : []),
    ["Đăng ký ngày", formatVnDate(entity.createdAt)],
  ];
  return (
    <section className="rounded-lg border bg-surface p-4">
      <h2 className="mb-3 font-semibold">Thông tin tổ chức</h2>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5">
            <dt className="text-xs text-text-3">{k}</dt>
            <dd className="text-sm break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  );
}
