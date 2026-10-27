"use client";

import { useActionState } from "react";
import { changeRepresentativeEmailAction, type ChangeEmailState } from "../actions";

const input = "rounded-md border border-line-strong bg-surface px-3 py-2";

/** Story 12: gives the Người dùng đại diện a new email to sign in and recover the account with. */
export function ChangeEmailForm({ entityId }: { entityId: string }) {
  const [state, action, pending] = useActionState<ChangeEmailState, FormData>(changeRepresentativeEmailAction.bind(null, entityId), {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email mới
        <input name="email" type="email" required className={input} />
      </label>
      <p className="text-xs text-text-3">
        Chỉ đổi khi đã xác minh người yêu cầu là người đại diện. Các liên kết đã gửi tới email cũ hết hiệu lực và mọi phiên đăng nhập bị đăng xuất; thao tác
        được ghi nhật ký.
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p role="status" className="text-sm text-brand">
          Đã đổi email. Người đại diện dùng email mới để đăng nhập hoặc chọn &quot;Quên mật khẩu&quot;.
        </p>
      )}
      <div>
        <button type="submit" disabled={pending} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold disabled:opacity-60">
          Đổi email
        </button>
      </div>
    </form>
  );
}
