"use client";

import { Send } from "lucide-react";
import { useActionState, useRef } from "react";
import { issueAdvisoryReportAction } from "../actions";

/** Story 56: "Phát hành báo cáo Tổ tư vấn", confirmed in a dialog saying what it locks and who hears of it (S52). */
export function IssueButton({ dossierId, version, blocked }: { dossierId: string; version: number; blocked: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(issueAdvisoryReportAction.bind(null, dossierId, version), {});
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={blocked}
        onClick={() => dialog.current?.showModal()}
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60"
      >
        <Send className="size-4" aria-hidden /> Phát hành báo cáo Tổ tư vấn
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <dialog ref={dialog} className="m-auto max-w-md rounded-lg border bg-surface p-5 text-sm shadow-card backdrop:bg-black/40">
        <form action={action} onSubmit={() => dialog.current?.close()} className="flex flex-col gap-4">
          <p className="font-semibold">Phát hành phiên bản 1?</p>
          <p>Báo cáo Tổ tư vấn sẽ bị khóa thành phiên bản 1; thành viên được phân công sẽ nhận thông báo. Sửa sau đó là phát hành phiên bản mới, có lý do.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg border px-3 py-1.5">
              Hủy
            </button>
            <button type="submit" disabled={pending} className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-brand-ink disabled:opacity-60">
              Phát hành
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
