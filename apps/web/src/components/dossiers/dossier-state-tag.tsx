import { DOSSIER_STATE_LABEL, type DossierState } from "@ocop/core";

const STYLE: Partial<Record<DossierState, string>> = {
  draft: "bg-surface-2 text-text-2 ring-1 ring-line-strong",
  supplement_requested: "bg-amber-soft text-amber",
  rejected_preliminary: "bg-amber-soft text-danger",
  withdrawn: "bg-surface-2 text-text-3 ring-1 ring-line-strong",
  not_passed: "bg-amber-soft text-danger",
};

/** Trạng thái of a hồ sơ, with the Vietnamese name of the luồng xử lý (mục 1.2). */
export function DossierStateTag({ state }: { state: DossierState }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STYLE[state] ?? "bg-brand-soft text-brand"}`}>
      {DOSSIER_STATE_LABEL[state]}
    </span>
  );
}
