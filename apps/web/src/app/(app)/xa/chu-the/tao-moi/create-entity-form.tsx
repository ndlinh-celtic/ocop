"use client";

import { ENTITY_KIND_LABEL, ENTITY_KINDS, type EntityKind } from "@ocop/core";
import { useActionState, useState } from "react";
import { createEntityAction, type CreateEntityState } from "../actions";

const input = "rounded-md border border-line-strong bg-surface px-3 py-2";
const label = "flex flex-col gap-1 text-sm font-medium";

/** Story 11: a Chủ thể and its Người dùng đại diện, opened by the Cán bộ xã in their own xã. */
export function CreateEntityForm({ wardName }: { wardName: string }) {
  const [state, action, pending] = useActionState<CreateEntityState, FormData>(createEntityAction, {});
  const v = state.values ?? {};
  const [kind, setKind] = useState<EntityKind>((v.kind as EntityKind | undefined) ?? "household");
  const household = kind === "household";
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className={label}>
        Loại tổ chức
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as EntityKind)} className={input}>
          {ENTITY_KINDS.map((k) => (
            <option key={k} value={k}>
              {ENTITY_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          {household ? "Họ tên chủ hộ" : "Tên tổ chức"}
          <input name="name" defaultValue={v.name} required className={input} />
        </label>
        <label className={label}>
          {household ? "Số định danh cá nhân của chủ hộ" : "Mã số thuế"}
          <input
            name="identifier"
            defaultValue={v.identifier}
            inputMode="numeric"
            required
            className={input}
            placeholder={household ? "12 chữ số" : "10 hoặc 13 chữ số"}
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Xã/phường đăng ký</span>
          <span className="rounded-md border border-line bg-surface-2 px-3 py-2 text-text-2">{wardName}</span>
        </div>
        <label className={label}>
          Địa chỉ
          <input name="address" defaultValue={v.address} required className={input} />
        </label>
        <label className={label}>
          Người đại diện
          <input name="representativeName" defaultValue={v.representativeName} required className={input} />
        </label>
        <label className={label}>
          Số điện thoại
          <input name="phone" defaultValue={v.phone} type="tel" inputMode="tel" required className={input} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Email của người đại diện
          <input name="email" defaultValue={v.email} type="email" required className={input} />
          <span className="text-xs font-normal text-text-3">Bắt buộc. Người đại diện nhận liên kết kích hoạt tại email này và tự đặt mật khẩu.</span>
        </label>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <div>
        <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60">
          Tạo Chủ thể
        </button>
      </div>
    </form>
  );
}
