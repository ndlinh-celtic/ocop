"use client";

import { GRADING_MODE_LABEL, GRADING_MODES, type AggregationRule, type GradingMode } from "@ocop/core";
import { useActionState, type ReactNode } from "react";
import type { RoundFormState } from "./actions";

type Action = (prev: RoundFormState, form: FormData) => Promise<RoundFormState>;

const input = "rounded-md border border-line-strong bg-surface px-3 py-2";
const label = "flex flex-col gap-1 text-sm font-medium";

function SaveRow({ state, pending }: { state: RoundFormState; pending: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60">
        {pending ? "Đang lưu…" : "Lưu"}
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
  );
}

function ConfigForm({ action: submit, title, children }: { action: Action; title: string; children: ReactNode }) {
  const [state, action, pending] = useActionState<RoundFormState, FormData>(submit, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
      <SaveRow state={state} pending={pending} />
    </form>
  );
}

/**
 * L07 HD-06: an opened round's Chế độ chấm and Quy tắc tổng hợp, editable until its first phiếu chấm
 * (the round page hides them once getRound reports gradingConfigLocked; the core refuses as well).
 */
export function RoundConfigForms({
  gradingMode,
  aggregation,
  changeGradingMode,
  changeAggregationRule,
}: {
  gradingMode: GradingMode;
  aggregation: AggregationRule;
  changeGradingMode: Action;
  changeAggregationRule: Action;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ConfigForm action={changeGradingMode} title="Chế độ chấm">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Chế độ chấm</legend>
          {GRADING_MODES.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input type="radio" name="gradingMode" value={m} defaultChecked={gradingMode === m} required />
              {GRADING_MODE_LABEL[m]}
            </label>
          ))}
        </fieldset>
      </ConfigForm>
      <ConfigForm action={changeAggregationRule} title="Quy tắc tổng hợp">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>
            Cách tổng hợp
            <select name="aggregationMethod" defaultValue={aggregation.method} className={input}>
              <option value="mean">Trung bình cộng</option>
            </select>
          </label>
          <label className={label}>
            Số người chấm tối thiểu
            <input name="minGraders" type="number" required min={1} max={50} step={1} defaultValue={aggregation.minGraders} className={input} />
          </label>
          <label className={label}>
            Ngưỡng cờ chênh lệch (điểm)
            <input
              name="deviationFlagPoints"
              type="number"
              required
              min={0.5}
              step={0.5}
              defaultValue={aggregation.deviationFlagPoints}
              className={input}
            />
          </label>
        </div>
      </ConfigForm>
    </div>
  );
}
