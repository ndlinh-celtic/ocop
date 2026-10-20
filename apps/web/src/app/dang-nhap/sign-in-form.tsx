"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "./actions";

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input name="email" type="email" autoComplete="username" required className="rounded-md border border-line-strong bg-surface px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Mật khẩu
        <input name="password" type="password" autoComplete="current-password" required className="rounded-md border border-line-strong bg-surface px-3 py-2" />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded-lg bg-brand text-brand-ink px-4 py-2 font-semibold disabled:opacity-60">
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}
