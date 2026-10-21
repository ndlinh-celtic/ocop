"use client";

import { CalendarClock } from "lucide-react";
import { useActionState } from "react";
import { formatVnDate } from "@/lib/format";
import type { WardDossierFormState } from "../actions";
import { transferRoundAction } from "../round-transfer-actions";

const FIELD = "w-full max-w-xl rounded-lg border border-line-strong bg-surface px-3 py-2";

/**
 * L06 XA-08 (stories 69, 70): chuyển đợt to a đợt of the same Phiên bản tiêu chí, not ended and within its
 * Hạn gửi tỉnh, with a reason. The hồ sơ keeps its state, Tiếp nhận and Cán bộ phụ trách.
 */
export function TransferRoundForm({ dossierId, version, rounds }: { dossierId: string; version: number; rounds: readonly { id: string; name: string; forwardingDeadline: Date }[] }) {
  const [state, action, pending] = useActionState<WardDossierFormState, FormData>(transferRoundAction.bind(null, dossierId, version), {});
  return (
    <section className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-2 font-semibold">Chuyển đợt</h2>
      <p className="mb-3 text-sm text-text-2">
        Hồ sơ được chuyển sang một đợt sau dùng cùng Phiên bản tiêu chí, giữ nguyên trạng thái, Tiếp nhận và Cán bộ phụ trách. Chủ thể được thông báo.
      </p>
      {rounds.length === 0 ? (
        <p className="text-sm text-text-3">Chưa có đợt nào nhận được hồ sơ này (cùng Phiên bản tiêu chí, đã mở, chưa kết thúc và còn trong Hạn gửi tỉnh).</p>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Đợt nhận hồ sơ
            <select name="roundId" required defaultValue="" className={FIELD}>
              <option value="" disabled>
                Chọn đợt
              </option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (Hạn gửi tỉnh {formatVnDate(r.forwardingDeadline)})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Lý do chuyển
            <textarea name="reason" required rows={2} maxLength={2000} className={FIELD} />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="flex w-fit items-center gap-2 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            <CalendarClock className="size-4" aria-hidden /> Chuyển đợt
          </button>
          {state.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}
          {state.saved && <p className="text-sm text-brand">Đã chuyển đợt.</p>}
        </form>
      )}
    </section>
  );
}
