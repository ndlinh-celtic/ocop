"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { RoundFormState } from "../actions";

/** S31 (L09 HD-01 story 10): choose the Hội đồng responsible for the đợt. */
export function CouncilPicker({
  action: submit,
  councils,
  current,
}: {
  action: (prev: RoundFormState, form: FormData) => Promise<RoundFormState>;
  councils: { id: string; name: string }[];
  current: string | null;
}) {
  const [state, action, pending] = useActionState<RoundFormState, FormData>(submit, {});
  if (councils.length === 0) {
    return (
      <p className="text-sm text-text-2">
        Chưa có hội đồng nào.{" "}
        <Link href="/so/hoi-dong" className="text-brand underline">
          Ghi nhận hội đồng
        </Link>{" "}
        trước.
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
        Hội đồng
        <select name="councilId" required defaultValue={current ?? ""} className="rounded-md border border-line-strong bg-surface px-3 py-2">
          <option value="" disabled>
            Chọn hội đồng
          </option>
          {councils.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60">
        {current ? "Đổi hội đồng" : "Gán hội đồng"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p role="status" className="text-sm text-brand">
          Đã lưu
        </p>
      )}
    </form>
  );
}
