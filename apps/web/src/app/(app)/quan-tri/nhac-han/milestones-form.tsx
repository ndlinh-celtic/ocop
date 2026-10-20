"use client";

import { useActionState } from "react";
import { setMilestonesAction, type MilestonesFormState } from "./actions";

/** The mốc nhắc hạn as days before a hạn, entered as a comma-separated list. */
export function MilestonesForm({ days }: { days: number[] }) {
  const [state, action, pending] = useActionState<MilestonesFormState, FormData>(setMilestonesAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Các mốc nhắc (số ngày trước hạn, cách nhau bởi dấu phẩy)
        <input name="days" required defaultValue={days.join(", ")} inputMode="numeric" className="rounded-md border border-line-strong bg-surface px-3 py-2" />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.saved && !pending && <p className="text-sm text-text-2">Đã lưu mốc nhắc hạn.</p>}
      <div>
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-ink disabled:opacity-60">
          {pending ? "Đang lưu…" : "Lưu"}
        </button>
      </div>
    </form>
  );
}
