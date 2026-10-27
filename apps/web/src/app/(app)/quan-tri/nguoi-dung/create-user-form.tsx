"use client";

import { useActionState } from "react";
import { createUserAction, type CreateUserState } from "./actions";

export function CreateUserForm() {
  const [state, action, pending] = useActionState<CreateUserState, FormData>(createUserAction, {});
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
        Họ tên
        <input name="fullName" required className="rounded-md border border-line-strong bg-surface px-3 py-2" />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
        Email
        <input name="email" type="email" required className="rounded-md border border-line-strong bg-surface px-3 py-2" />
      </label>
      <button type="submit" disabled={pending} className="rounded-lg bg-brand text-brand-ink px-4 py-2 font-semibold disabled:opacity-60">
        Thêm cán bộ
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.created && (
        <p role="status" className="text-sm text-brand">
          Đã gửi email kích hoạt tới {state.created}
        </p>
      )}
    </form>
  );
}
