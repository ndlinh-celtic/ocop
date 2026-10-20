"use client";

import { useActionState } from "react";
import type { RoundActionState } from "./actions";

type Action = (prev: RoundActionState, form: FormData) => Promise<RoundActionState>;

/** A one-click round action (mở đợt, xóa đợt) that asks for confirmation and shows a refusal inline. */
export function RoundActionButton({ action: submit, label, confirm, danger }: { action: Action; label: string; confirm: string; danger?: boolean }) {
  const [state, action, pending] = useActionState<RoundActionState, FormData>(submit, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      className="flex flex-col gap-1"
    >
      <button
        type="submit"
        disabled={pending}
        className={
          danger
            ? "rounded-lg border border-danger px-4 py-2 text-sm font-medium text-danger disabled:opacity-60"
            : "rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60"
        }
      >
        {label}
      </button>
      {state.error && (
        <p role="alert" className="max-w-sm text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
