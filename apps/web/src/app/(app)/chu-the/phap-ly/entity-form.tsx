"use client";

import type { EntityView } from "@ocop/core";
import { useActionState } from "react";
import { updateEntityAction, type EntityFormState } from "./actions";

const input = "rounded-md border border-line-strong bg-surface px-3 py-2";
const label = "flex flex-col gap-1 text-sm font-medium";

/** Stories 9, 10: edit the organisation details and the xã/phường đăng ký. */
export function EntityForm({ entity, wards }: { entity: EntityView; wards: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<EntityFormState, FormData>(updateEntityAction.bind(null, entity.id), {});
  const household = entity.kind === "household";
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          {household ? "Họ tên chủ hộ" : "Tên tổ chức"}
          <input name="name" defaultValue={entity.name} required className={input} />
        </label>
        <label className={label}>
          Xã/phường đăng ký
          <select name="wardId" required defaultValue={entity.ward.id} className={input}>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-text-3">Hồ sơ đã nộp vẫn thuộc xã/phường lúc nộp.</span>
        </label>
        <label className={`${label} sm:col-span-2`}>
          Địa chỉ
          <input name="address" defaultValue={entity.address} required className={input} />
        </label>
        <label className={label}>
          Người đại diện
          <input name="representativeName" defaultValue={entity.representativeName} required className={input} />
        </label>
        <label className={label}>
          Số điện thoại
          <input name="phone" type="tel" defaultValue={entity.phone} required className={input} />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.saved && !pending && (
        <p role="status" className="text-sm text-brand">
          Đã lưu thông tin tổ chức.
        </p>
      )}
      <div>
        <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60">
          Lưu thông tin
        </button>
      </div>
    </form>
  );
}
