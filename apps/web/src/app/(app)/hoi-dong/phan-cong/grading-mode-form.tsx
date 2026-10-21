"use client";

import { GRADING_MODE_LABEL, GRADING_MODES, type GradingMode } from "@ocop/core";
import { Lock } from "lucide-react";
import { useActionState } from "react";
import { changeGradingModeAction, type GradingModeFormState } from "./actions";

export interface RoundModeRow {
  roundId: string;
  name: string;
  gradingMode: GradingMode;
  minGraders: number;
  /** From the đợt's first Giao chấm on (its first Phiếu chấm), Chế độ chấm and Quy tắc tổng hợp are fixed. */
  locked: boolean;
}

/**
 * S41 Chế độ chấm (L09 HD-06, stories 20, 21): per đợt of the Hội đồng, the Thư ký confirms or changes how it
 * is graded until its first Giao chấm; then it shows as fixed, with the reason.
 */
export function GradingModeForm({ round }: { round: RoundModeRow }) {
  const [state, action, pending] = useActionState<GradingModeFormState, FormData>(changeGradingModeAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg border bg-surface p-4 shadow-card" data-testid="grading-mode">
      <input type="hidden" name="roundId" value={round.roundId} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{round.name}</h2>
        <span className="text-xs text-text-3">Tối thiểu {round.minGraders} người chấm</span>
      </div>
      {round.locked ? (
        <p className="flex items-center gap-2 text-sm text-text-2">
          <Lock className="size-4" aria-hidden />
          {GRADING_MODE_LABEL[round.gradingMode]}. Đợt đã có Phiếu chấm nên Chế độ chấm và Quy tắc tổng hợp không đổi được nữa.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <fieldset className="flex flex-wrap gap-3">
            <legend className="sr-only">Chế độ chấm</legend>
            {GRADING_MODES.map((m) => (
              <label key={m} className="flex items-center gap-1">
                <input type="radio" name="gradingMode" value={m} defaultChecked={m === round.gradingMode} />
                {GRADING_MODE_LABEL[m]}
              </label>
            ))}
          </fieldset>
          <button type="submit" disabled={pending} className="rounded-lg border border-line-strong px-3 py-1 font-medium disabled:opacity-60">
            Xác nhận Chế độ chấm
          </button>
        </div>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.saved && !pending && (
        <p role="status" className="text-sm text-brand">
          Đã lưu Chế độ chấm.
        </p>
      )}
    </form>
  );
}
