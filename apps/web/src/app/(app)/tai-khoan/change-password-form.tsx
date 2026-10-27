"use client";

import { MIN_PASSWORD_LENGTH } from "@ocop/core";
import { useActionState } from "react";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const field = "rounded-md border border-line-strong bg-surface px-3 py-2";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Mật khẩu hiện tại
        <input name="currentPassword" type="password" autoComplete="current-password" required className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Mật khẩu mới (ít nhất {MIN_PASSWORD_LENGTH} ký tự)
        <input name="newPassword" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nhập lại mật khẩu mới
        <input name="confirm" type="password" autoComplete="new-password" required className={field} />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-brand">
          Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.
        </p>
      )}
      <button type="submit" disabled={pending} className="self-start rounded-md bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60">
        Đổi mật khẩu
      </button>
    </form>
  );
}
