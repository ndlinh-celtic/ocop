"use client";

import { ENTITY_KIND_LABEL, ENTITY_KINDS, type EntityKind } from "@ocop/core";
import { Building2, House, MailCheck, Users } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { registerAction, type RegisterState } from "./actions";

const KIND_ICON = { enterprise: Building2, cooperative: Users, household: House } as const;
const input = "rounded-md border border-line-strong bg-surface px-3 py-2";
const label = "flex flex-col gap-1 text-sm font-medium";

export function RegisterForm({ wards }: { wards: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerAction, {});
  const [kind, setKind] = useState<EntityKind>("household");

  if (state.sentTo) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <MailCheck className="size-10 text-brand" aria-hidden />
        <h2 className="text-lg font-semibold">Kiểm tra hộp thư của bạn</h2>
        <p className="text-sm text-text-2">
          Đã gửi liên kết kích hoạt tới <b>{state.sentTo}</b>. Mở email và bấm &quot;Kích hoạt tài khoản&quot; để đặt mật khẩu. Liên kết có hiệu lực trong
          72 giờ.
        </p>
        <p className="text-sm text-text-3">Không thấy email? Kiểm tra mục Thư rác hoặc Quảng cáo.</p>
        <Link href="/dang-nhap" className="text-sm text-brand">
          Về trang đăng nhập
        </Link>
      </div>
    );
  }

  const household = kind === "household";
  const v = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Loại tổ chức</legend>
        <div className="grid grid-cols-3 gap-2">
          {ENTITY_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <label
                key={k}
                className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-line-strong p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
              >
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                <Icon className="size-5" aria-hidden />
                {ENTITY_KIND_LABEL[k]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <label className={label}>
        {household ? "Họ tên chủ hộ" : "Tên tổ chức"}
        <input name="name" defaultValue={v.name} required className={input} />
      </label>
      <label className={label}>
        {household ? "Số định danh cá nhân của chủ hộ" : "Mã số thuế"}
        <input name="identifier" defaultValue={v.identifier} inputMode="numeric" required className={input} placeholder={household ? "12 chữ số" : "10 hoặc 13 chữ số"} />
        {household && <span className="text-xs font-normal text-text-3">Số định danh chỉ hiển thị đầy đủ cho chính bạn; người khác chỉ thấy 4 số cuối.</span>}
      </label>
      <label className={label}>
        Xã/phường
        <select name="wardId" required defaultValue={v.wardId ?? ""} className={input}>
          <option value="" disabled>
            Chọn xã/phường
          </option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Địa chỉ
        <input name="address" defaultValue={v.address} autoComplete="street-address" required className={input} />
      </label>
      <label className={label}>
        Người đại diện
        <input name="representativeName" defaultValue={v.representativeName} autoComplete="name" required className={input} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Số điện thoại
          <input name="phone" defaultValue={v.phone} type="tel" inputMode="tel" autoComplete="tel" required className={input} />
        </label>
        <label className={label}>
          Email
          <input name="email" defaultValue={v.email} type="email" autoComplete="email" required className={input} />
          <span className="text-xs font-normal text-text-3">Dùng để đăng nhập và nhận thông báo</span>
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="agree" required className="mt-1" />
        <span>Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo vệ dữ liệu cá nhân của hệ thống.</span>
      </label>
      <p className="rounded-md bg-brand-soft p-3 text-sm">Hộ sản xuất cần giúp đỡ? Liên hệ UBND xã để được cán bộ hỗ trợ tạo tài khoản.</p>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60">
        Tạo tài khoản
      </button>
    </form>
  );
}
