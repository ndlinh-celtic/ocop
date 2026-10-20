import { ROUND_STATUS_LABEL, type RoundStatus } from "@ocop/core";

const STYLE: Record<RoundStatus, string> = {
  draft: "bg-surface-2 text-text-2 ring-1 ring-line-strong",
  open_for_submission: "bg-brand-soft text-brand",
  submission_closed: "bg-amber-soft text-amber",
  ended: "bg-surface-2 text-text-3",
};

/** Trạng thái đợt of a Đợt đánh giá. */
export function RoundStatusTag({ status }: { status: RoundStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLE[status]}`}>{ROUND_STATUS_LABEL[status]}</span>;
}
