"use client";

import type { DraftEdit } from "@ocop/core";
import { Pencil } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type { EditTarget } from "@/components/criteria/edit-target";
import { editDraftAction } from "./edit-actions";

export type FieldType = "text" | "textarea" | "number" | "date" | "star";
export interface Field {
  key: string;
  label: string;
  type: FieldType;
}

export const name: Field = { key: "name", label: "Tên", type: "text" };
export const points: Field = { key: "points", label: "Điểm khai báo", type: "number" };

/** The form of each kind of node; keys match DraftEdit `changes`, which the core checks. */
export const FIELDS: Record<DraftEdit["node"], Field[]> = {
  version: [
    { key: "legalBasis", label: "Văn bản căn cứ", type: "text" },
    { key: "issuedOn", label: "Ngày ban hành", type: "date" },
    { key: "effectiveOn", label: "Ngày hiệu lực (ghi nhận)", type: "date" },
  ],
  thresholds: ([2, 3, 4, 5] as const).map((s) => ({ key: String(s), label: `${s} sao từ (điểm)`, type: "number" as const })),
  productGroup: [name],
  subgroup: [name],
  set: [name, { key: "totalPoints", label: "Tổng điểm khai báo", type: "number" }],
  exclusion: [{ key: "description", label: "Điều kiện loại", type: "textarea" }],
  part: [name, points],
  section: [name, points],
  criterionGroup: [name, points],
  criterion: [
    { key: "code", label: "Mã tiêu chí", type: "text" },
    { key: "name", label: "Tên", type: "textarea" },
    { key: "requirement", label: "Yêu cầu", type: "textarea" },
    { key: "note", label: "Ghi chú", type: "textarea" },
    { key: "maxPoints", label: "Điểm tối đa", type: "number" },
  ],
  scoreLevel: [
    { key: "description", label: "Mô tả", type: "textarea" },
    { key: "points", label: "Điểm", type: "number" },
    { key: "minimumStar", label: "Sao tối thiểu", type: "star" },
    { key: "branch", label: "Nhãn nhánh (a, b…; để trống nếu không chia nhánh)", type: "text" },
  ],
};

/** Form text back to the value DraftEdit expects; a blank number stays a string so the core reports it. */
export function valueOf(type: FieldType, raw: string): string | number | null {
  if (type === "number") return raw.trim() === "" ? raw : Number(raw.replace(",", "."));
  if (type === "star") return raw === "" ? null : Number(raw);
  return raw;
}

const inputClass = "w-full rounded-md border border-line-strong bg-surface px-3 py-2";

/** L19 AD-03: the "Sửa" button of one node of a draft and its form; only the changed fields are sent. */
export function EditNode({ versionId, target }: { versionId: string; target: EditTarget }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const fields = FIELDS[target.node];

  const submit = (form: FormData) => {
    const changes: Record<string, unknown> = {};
    for (const f of fields) {
      const value = valueOf(f.type, String(form.get(f.key) ?? ""));
      if (value !== (target.values[f.key] ?? (f.type === "star" ? null : ""))) changes[f.key] = value;
    }
    if (Object.keys(changes).length === 0) return setOpen(false);
    const edit = { node: target.node, ...(target.id ? { id: target.id } : {}), changes } as DraftEdit;
    start(async () => {
      const outcome = await editDraftAction(versionId, edit);
      if (outcome.ok) setOpen(false);
      else setError(outcome.error);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (setError(undefined), setOpen(true))}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-normal text-text-3 hover:bg-surface-2 hover:text-brand"
        aria-label={`Sửa ${target.label}`}
        title={`Sửa ${target.label}`}
      >
        <Pencil className="size-3.5" aria-hidden />
        <span className={target.node === "version" ? "" : "sr-only"}>Sửa {target.node === "version" ? target.label : ""}</span>
      </button>
      {open && (
        <NodeFormDialog
          title={`Sửa ${target.label}`}
          fields={fields}
          values={target.values}
          error={error}
          pending={pending}
          onSubmit={submit}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * The modal form of one node, shared by "Sửa" and "Thêm" (#23). Portalled: the buttons sit inside headings,
 * paragraphs and table cells, where a <div> cannot.
 */
export function NodeFormDialog({
  title,
  fields,
  values,
  error,
  pending,
  submitLabel = "Lưu",
  onSubmit,
  onCancel,
}: {
  title: string;
  fields: Field[];
  values: Record<string, string | number | null>;
  error?: string;
  pending: boolean;
  submitLabel?: string;
  onSubmit: (form: FormData) => void;
  onCancel: () => void;
}) {
  const formId = useId();
  return createPortal(
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-[var(--overlay)] p-4 text-left text-base font-normal text-text"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-title`}
    >
      <form action={onSubmit} className="flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg bg-surface p-6 shadow-pop">
        <h2 id={`${formId}-title`} className="text-lg font-semibold">
          {title}
        </h2>
        {fields.map((f) => {
          const id = `${formId}-${f.key}`;
          const current = values[f.key];
          const value = current === null || current === undefined ? "" : String(current);
          return (
            <label key={f.key} htmlFor={id} className="flex flex-col gap-1 text-sm">
              {f.label}
              {f.type === "textarea" ? (
                <textarea id={id} name={f.key} defaultValue={value} rows={3} className={inputClass} />
              ) : f.type === "star" ? (
                <select id={id} name={f.key} defaultValue={value} className={inputClass}>
                  <option value="">Không yêu cầu</option>
                  <option value="3">3 sao</option>
                  <option value="4">4 sao</option>
                  <option value="5">5 sao</option>
                </select>
              ) : (
                <input
                  id={id}
                  name={f.key}
                  type={f.type === "number" ? "text" : f.type}
                  inputMode={f.type === "number" ? "decimal" : undefined}
                  defaultValue={value}
                  className={inputClass}
                />
              )}
            </label>
          );
        })}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-line-strong px-4 py-2">
            Hủy
          </button>
          <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 font-medium text-brand-ink disabled:opacity-60">
            {pending ? "Đang lưu…" : submitLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
