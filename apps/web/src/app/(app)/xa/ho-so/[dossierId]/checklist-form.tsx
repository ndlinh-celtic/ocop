"use client";

import { CHECKLIST_RESULT_LABEL, CHECKLIST_RESULTS, type DossierChecklist } from "@ocop/core";
import { ClipboardCheck } from "lucide-react";
import { useActionState } from "react";
import { assessChecklistAction, type ChecklistFormState } from "./checklist-actions";

const SUGGESTION_LABEL = {
  eligible: "Đủ điều kiện chuyển tỉnh",
  not_eligible: "Chưa đủ",
} as const;

function Suggestion({ checklist }: { checklist: DossierChecklist }) {
  const eligible = checklist.suggestion === "eligible";
  return (
    <p role="status" className={`rounded-md px-3 py-2 text-sm ${eligible ? "bg-brand-soft text-brand" : "bg-amber-soft text-amber"}`}>
      Đề xuất của hệ thống: <b>{SUGGESTION_LABEL[checklist.suggestion]}</b>
      {checklist.complete ? "" : " (còn mục chưa đánh giá)"}. Quyết định gửi tỉnh vẫn do cán bộ xã đưa ra.
    </p>
  );
}

/**
 * L06 XA-04 (stories 61, 62): each item of the đợt's Checklist sơ bộ as Đạt, Không đạt or Cần xác minh,
 * with nhận xét (required for Cần xác minh), and the system's suggestion. Read-only when `editable` is false.
 */
export function ChecklistForm({
  dossierId,
  version,
  checklist,
  editable,
}: {
  dossierId: string;
  version: number;
  checklist: DossierChecklist;
  editable: boolean;
}) {
  const [state, action, pending] = useActionState<ChecklistFormState, FormData>(assessChecklistAction.bind(null, dossierId, version), {});
  return (
    <section className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-1 font-semibold">Checklist sơ bộ</h2>
      <p className="mb-3 text-sm text-text-3">Nhận xét là ghi chú làm việc của xã, Chủ thể không xem được.</p>
      <form action={action} className="flex flex-col gap-4">
        <ol className="flex flex-col gap-4">
          {checklist.items.map((item, n) => (
            <li key={item.code} className="flex flex-col gap-2 border-b pb-4 last:border-0">
              <input type="hidden" name="itemCode" value={item.code} />
              <p className="text-sm font-medium">
                {n + 1}. {item.label}
              </p>
              <fieldset className="flex flex-wrap gap-4" disabled={!editable}>
                <legend className="sr-only">Kết quả mục {n + 1}</legend>
                {CHECKLIST_RESULTS.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <input type="radio" name={`result.${item.code}`} value={r} defaultChecked={item.result === r} />
                    {CHECKLIST_RESULT_LABEL[r]}
                  </label>
                ))}
              </fieldset>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-text-3">Nhận xét</span>
                <textarea
                  name={`comment.${item.code}`}
                  rows={2}
                  maxLength={2000}
                  defaultValue={item.comment ?? ""}
                  readOnly={!editable}
                  className="rounded-md border border-line-strong bg-surface px-3 py-2"
                />
              </label>
            </li>
          ))}
        </ol>
        <Suggestion checklist={checklist} />
        {editable && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="flex w-fit items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60"
            >
              <ClipboardCheck className="size-4" aria-hidden /> {pending ? "Đang lưu…" : "Lưu Checklist sơ bộ"}
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
          </div>
        )}
      </form>
    </section>
  );
}
