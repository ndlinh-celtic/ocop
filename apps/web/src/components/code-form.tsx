"use client";

import { useActionState } from "react";

export interface CodeFormState {
  error?: string;
}

/** A six-digit code field, used by the TOTP step of sign-in and by TOTP enrolment. */
export function CodeForm({ action, submitLabel }: { action: (s: CodeFormState, f: FormData) => Promise<CodeFormState>; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Mã xác thực 6 số
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          className="rounded-lg border px-3 py-2 text-center text-lg tracking-[0.4em]"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
        {pending ? "Đang kiểm tra…" : submitLabel}
      </button>
    </form>
  );
}
