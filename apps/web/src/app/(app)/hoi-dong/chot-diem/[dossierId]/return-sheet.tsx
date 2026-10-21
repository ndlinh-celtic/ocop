"use client";

import { Undo2 } from "lucide-react";
import { useActionState, useRef } from "react";
import { returnScoreSheetAction, type ReturnSheetFormState } from "./return-actions";

/**
 * L15 HD-05 (stories 102 to 105): "Trả phiếu" for one thành viên chấm, asking the lý do in a dialog that says
 * what happens: the phiếu is kept as bị thay thế, the thành viên gets a lần chấm mới điền sẵn and hears why.
 */
export function ReturnSheetButton({ dossierId, sheetId, fullName, absent }: { dossierId: string; sheetId: string; fullName: string; absent: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<ReturnSheetFormState, FormData>(returnScoreSheetAction.bind(null, dossierId, sheetId), {});
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium"
        data-testid="return-sheet"
      >
        <Undo2 className="size-3.5" aria-hidden /> Trả phiếu
      </button>
      {state.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}
      <dialog ref={dialog} className="m-auto w-full max-w-md rounded-lg border bg-surface p-5 text-sm shadow-card backdrop:bg-black/40">
        <form action={action} onSubmit={() => dialog.current?.close()} className="flex flex-col gap-4">
          <p className="font-semibold">Trả phiếu cho {fullName}?</p>
          <p>
            {absent ? "Phiếu Vắng" : "Phiếu đã xác nhận"} được giữ nguyên và đánh dấu bị thay thế. Thành viên nhận lần chấm mới, điền sẵn từ phiếu cũ, cùng thông
            báo kèm lý do. Nếu số phiếu đã xác nhận còn lại dưới tối thiểu, hồ sơ về Thành viên xem xét.
          </p>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Lý do</span>
            <textarea name="reason" required maxLength={2000} rows={3} className="rounded-md border bg-surface px-3 py-2" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg border px-3 py-1.5">
              Hủy
            </button>
            <button type="submit" disabled={pending} className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-brand-ink disabled:opacity-60">
              Trả phiếu
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
