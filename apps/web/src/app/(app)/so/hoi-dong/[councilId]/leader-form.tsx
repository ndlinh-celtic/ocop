"use client";

import { useActionState } from "react";
import type { LeaderState } from "../actions";

/** S40 (L09 HD-01 stories 2, 3): choose the Tổ trưởng among the Thành viên Tổ tư vấn in force. */
export function LeaderForm({
  action: submit,
  advisors,
  current,
}: {
  action: (prev: LeaderState, form: FormData) => Promise<LeaderState>;
  advisors: { userId: string; fullName: string }[];
  current: string | null;
}) {
  const [state, action, pending] = useActionState<LeaderState, FormData>(submit, {});
  if (advisors.length === 0) {
    return <p className="text-sm text-text-2">Chưa có Thành viên Tổ tư vấn. Đề nghị Quản trị cấp Phân vai Thành viên Tổ tư vấn trên hội đồng này trước.</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
        Tổ trưởng Tổ tư vấn
        <select name="userId" required defaultValue={current ?? ""} className="rounded-md border border-line-strong bg-surface px-3 py-2">
          <option value="" disabled>
            Chọn Thành viên Tổ tư vấn
          </option>
          {advisors.map((a) => (
            <option key={a.userId} value={a.userId}>
              {a.fullName}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60">
        {current ? "Đổi Tổ trưởng" : "Chỉ định Tổ trưởng"}
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
