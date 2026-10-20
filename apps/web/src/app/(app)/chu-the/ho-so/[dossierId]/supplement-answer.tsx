"use client";

import { useActionState } from "react";
import { respondSupplementAction, type AnswerFormState } from "../actions";

/** L04 CT-11 (story 51): the Chủ thể's answer to one nội dung of the open yêu cầu bổ sung. */
export function SupplementAnswerForm({
  dossierId,
  version,
  itemId,
  response,
  onBehalf,
}: {
  dossierId: string;
  version: number;
  itemId: string;
  response: string;
  /** Nhập hộ (L01): the Chủ thể the Cán bộ xã answers for. */
  onBehalf?: string;
}) {
  const [state, action, pending] = useActionState<AnswerFormState, FormData>(respondSupplementAction.bind(null, dossierId, version, itemId, onBehalf), {});
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        Trả lời
        <textarea name="response" defaultValue={response} maxLength={2000} rows={2} className="rounded-lg border border-line-strong bg-surface px-3 py-2" />
      </label>
      <button type="submit" disabled={pending} className="w-fit rounded-lg border border-line-strong px-3 py-1.5 text-sm font-medium disabled:opacity-60">
        Lưu câu trả lời
      </button>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : (
        state.saved && (
          <p role="status" className="text-sm text-brand">
            Đã lưu.
          </p>
        )
      )}
    </form>
  );
}
