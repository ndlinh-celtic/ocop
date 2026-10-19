"use client";

import { useActionState } from "react";
import { forgotPasswordAction, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(forgotPasswordAction, {});
  if (state.sent) {
    return (
      <p role="status" className="rounded-md bg-brand-soft p-3 text-sm">
        Nếu email có tài khoản, hệ thống đã gửi liên kết đặt lại mật khẩu. Liên kết hết hạn sau 1 giờ.
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input name="email" type="email" required autoComplete="username" className="rounded-md border border-line-strong bg-surface px-3 py-2" />
      </label>
      <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60">
        Gửi liên kết đặt lại
      </button>
    </form>
  );
}
