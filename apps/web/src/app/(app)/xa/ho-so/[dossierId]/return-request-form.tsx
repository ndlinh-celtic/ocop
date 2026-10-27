"use client";

import { Undo2 } from "lucide-react";
import { useActionState } from "react";
import { requestReturnAction, type ReturnRequestFormState } from "./return-request-actions";

type Submit = (dossierId: string, expectedVersion: number, prev: ReturnRequestFormState, form: FormData) => Promise<ReturnRequestFormState>;

const XA_INTRO = "Khi phát hiện sai sót trong hồ sơ đã gửi tỉnh, gửi Sở đề nghị trả về kèm lý do. Sở quyết định có trả về hay không.";

/**
 * L04 (story 59): a hồ sơ Đã chuyển tỉnh stays with the Sở; the xã may only ask it to trả về, with a lý do.
 * L10 TM-03 (#57 story 51) uses the same form for the Tổ tư vấn, with its own `submit` and `intro`.
 */
export function ReturnRequestForm({
  dossierId,
  version,
  submit = requestReturnAction,
  intro = XA_INTRO,
}: {
  dossierId: string;
  version: number;
  submit?: Submit;
  intro?: string;
}) {
  const [state, action, pending] = useActionState<ReturnRequestFormState, FormData>(submit.bind(null, dossierId, version), {});
  return (
    <section className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-2 font-semibold">Đề nghị Sở trả về</h2>
      <p className="mb-3 text-sm text-text-2">{intro}</p>
      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Lý do
          <textarea name="reason" required maxLength={2000} rows={3} className="rounded-lg border border-line-strong bg-surface px-3 py-2" />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex w-fit items-center gap-2 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          <Undo2 className="size-4" aria-hidden /> Gửi đề nghị trả về
        </button>
        {state.saved && (
          <p role="status" className="text-sm text-brand">
            Đã gửi đề nghị trả về cho Sở.
          </p>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
      </form>
    </section>
  );
}
