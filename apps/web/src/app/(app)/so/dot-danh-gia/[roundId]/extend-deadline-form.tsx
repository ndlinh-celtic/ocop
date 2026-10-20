"use client";

import { EXTENDABLE_DEADLINE_LABEL, EXTENDABLE_DEADLINES, type ExtendableDeadline } from "@ocop/core";
import { useActionState, useState } from "react";
import type { ExtendDeadlineState } from "./extension-actions";

const input = "rounded-md border border-line-strong bg-surface px-3 py-2";
const label = "flex flex-col gap-1 text-sm font-medium";

/**
 * L07 Gia hạn đợt: Cán bộ Sở picks Hạn nộp xã, Hạn gửi tỉnh or Hạn đánh giá tỉnh, a later date and a reason. `current` holds
 * each deadline as YYYY-MM-DD (Vietnam), the earliest date the picker offers is the day after it. Once submission
 * has closed, Hạn nộp xã is no longer offered: a round never goes back to Đang nhận nộp.
 */
export function ExtendDeadlineForm({
  action: submit,
  current,
  submissionClosed,
}: {
  action: (prev: ExtendDeadlineState, form: FormData) => Promise<ExtendDeadlineState>;
  current: Record<ExtendableDeadline, string>;
  submissionClosed: boolean;
}) {
  const [state, action, pending] = useActionState<ExtendDeadlineState, FormData>(submit, {});
  const choices = EXTENDABLE_DEADLINES.filter((d) => !(submissionClosed && d === "submission"));
  const [deadline, setDeadline] = useState<ExtendableDeadline>(choices[0]!);
  return (
    <form key={state.done?.at} action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Mốc hạn
          <select name="deadline" value={deadline} onChange={(e) => setDeadline(e.target.value as ExtendableDeadline)} className={input}>
            {choices.map((d) => (
              <option key={d} value={d}>
                {EXTENDABLE_DEADLINE_LABEL[d]} (hiện tại {current[d].split("-").reverse().join("/")})
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Hạn mới (hết ngày, giờ Việt Nam)
          <input name="newDate" type="date" required min={nextDay(current[deadline])} className={input} />
        </label>
      </div>
      <label className={label}>
        Lý do gia hạn
        <textarea name="reason" required maxLength={2000} rows={3} className={input} />
      </label>
      {submissionClosed && <p className="text-sm text-text-2">Đợt đã đóng nộp: Hạn nộp xã không gia hạn được nữa.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60">
          Gia hạn
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.done && (
          <p role="status" className="text-sm text-text-2">
            Đã gia hạn.
          </p>
        )}
      </div>
    </form>
  );
}

function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
