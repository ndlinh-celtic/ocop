"use client";

import { MIN_PASSWORD_LENGTH } from "@ocop/core";
import { useActionState } from "react";
import { resetPasswordAction, type ResetState } from "./actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPasswordAction.bind(null, token), {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Mật khẩu mới (ít nhất {MIN_PASSWORD_LENGTH} ký tự)
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          className="rounded-md border border-line-strong bg-surface px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nhập lại mật khẩu
        <input name="confirm" type="password" autoComplete="new-password" required className="rounded-md border border-line-strong bg-surface px-3 py-2" />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60">
        Đặt mật khẩu mới
      </button>
    </form>
  );
}
