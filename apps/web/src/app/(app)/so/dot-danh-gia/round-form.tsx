"use client";

import { GRADING_MODE_LABEL, GRADING_MODES } from "@ocop/core";
import { useActionState } from "react";
import type { RoundFormState } from "./actions";

/** Field values as the form shows them; deadlines are calendar dates in Vietnam (YYYY-MM-DD). */
export interface RoundFormValues {
  name: string;
  year: number;
  submissionDeadline: string;
  forwardingDeadline: string;
  evaluationDeadline: string;
  criteriaVersionId: string;
  gradingMode: string;
  minGraders: number;
  deviationFlagPoints: number;
}

export interface VersionOption {
  id: string;
  legalBasis: string;
  issuedOn: string;
}

const input = "rounded-md border border-line-strong bg-surface px-3 py-2";
const label = "flex flex-col gap-1 text-sm font-medium";

/** S81: create or edit a Nháp Đợt đánh giá (L07 SO-01). Only published Phiên bản tiêu chí are offered. */
export function RoundForm({
  action: submit,
  values,
  versions,
  submitLabel,
}: {
  action: (prev: RoundFormState, form: FormData) => Promise<RoundFormState>;
  values: RoundFormValues;
  versions: VersionOption[];
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState<RoundFormState, FormData>(submit, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <label className={label}>
          Tên đợt
          <input name="name" required defaultValue={values.name} className={input} />
        </label>
        <label className={label}>
          Năm
          <input name="year" type="number" required min={2000} max={2100} defaultValue={values.year} className={input} />
        </label>
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-1 text-sm text-text-2">Mỗi mốc hạn tính đến hết ngày đã chọn (23:59:59 giờ Việt Nam).</legend>
        <label className={label}>
          Hạn nộp xã
          <input name="submissionDeadline" type="date" required defaultValue={values.submissionDeadline} className={input} />
        </label>
        <label className={label}>
          Hạn gửi tỉnh
          <input name="forwardingDeadline" type="date" required defaultValue={values.forwardingDeadline} className={input} />
        </label>
        <label className={label}>
          Hạn đánh giá tỉnh
          <input name="evaluationDeadline" type="date" required defaultValue={values.evaluationDeadline} className={input} />
        </label>
      </fieldset>
      <label className={label}>
        Phiên bản tiêu chí
        <select name="criteriaVersionId" required defaultValue={values.criteriaVersionId} className={input}>
          <option value="">Chọn phiên bản đã phát hành</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.legalBasis} (ban hành {v.issuedOn.split("-").reverse().join("/")})
            </option>
          ))}
        </select>
        {versions.length === 0 && <span className="text-xs text-warning">Chưa có Phiên bản tiêu chí nào được phát hành.</span>}
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Chế độ chấm</legend>
        {GRADING_MODES.map((m) => (
          <label key={m} className="flex items-center gap-2 text-sm">
            <input type="radio" name="gradingMode" value={m} defaultChecked={values.gradingMode === m} required />
            {GRADING_MODE_LABEL[m]}
          </label>
        ))}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-medium">Quy tắc tổng hợp</legend>
        <label className={label}>
          Cách tổng hợp
          <select name="aggregationMethod" defaultValue="mean" className={input}>
            <option value="mean">Trung bình cộng</option>
          </select>
        </label>
        <label className={label}>
          Số người chấm tối thiểu
          <input name="minGraders" type="number" required min={1} max={50} step={1} defaultValue={values.minGraders} className={input} />
        </label>
        <label className={label}>
          Ngưỡng cờ chênh lệch (điểm)
          <input name="deviationFlagPoints" type="number" required min={0.5} step={0.5} defaultValue={values.deviationFlagPoints} className={input} />
        </label>
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60">
          {pending ? "Đang lưu…" : submitLabel}
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
    </form>
  );
}
