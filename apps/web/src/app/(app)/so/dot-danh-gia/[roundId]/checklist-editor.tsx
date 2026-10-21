"use client";

import type { ChecklistItem } from "@ocop/core";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import type { RoundFormState } from "../actions";

interface Row {
  /** Stable React key; also distinguishes new rows, which have no code yet. */
  key: string;
  code: string;
  label: string;
}

let nextKey = 0;
const newKey = () => `new-${++nextKey}`;

const iconButton = "rounded-md border border-line-strong p-2 disabled:opacity-40";

/**
 * L06 XA-04 (story 60): the Checklist sơ bộ of a Nháp round, as an ordered list of items to reword,
 * add, remove or reorder. Existing items keep their code so a rename stays the same item.
 */
export function ChecklistEditor({ items, action: submit }: { items: ChecklistItem[]; action: (prev: RoundFormState, form: FormData) => Promise<RoundFormState> }) {
  const [rows, setRows] = useState<Row[]>(() => items.map((i) => ({ key: i.code, code: i.code, label: i.label })));
  const [state, action, pending] = useActionState<RoundFormState, FormData>(submit, {});

  const move = (n: number, by: number) =>
    setRows((rs) => {
      const next = [...rs];
      const [row] = next.splice(n, 1);
      next.splice(n + by, 0, row!);
      return next;
    });

  return (
    <form action={action} className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {rows.map((row, n) => (
          <li key={row.key} className="flex items-center gap-2">
            <span className="w-6 text-right text-sm text-text-3">{n + 1}.</span>
            <input type="hidden" name="code" value={row.code} />
            <input
              name="label"
              required
              maxLength={500}
              aria-label={`Mục ${n + 1}`}
              value={row.label}
              onChange={(e) => setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, label: e.target.value } : r)))}
              className="min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm"
            />
            <button type="button" className={iconButton} disabled={n === 0} onClick={() => move(n, -1)} aria-label={`Đưa mục ${n + 1} lên`}>
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button type="button" className={iconButton} disabled={n === rows.length - 1} onClick={() => move(n, 1)} aria-label={`Đưa mục ${n + 1} xuống`}>
              <ArrowDown className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className={iconButton}
              disabled={rows.length === 1}
              onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
              aria-label={`Xóa mục ${n + 1}`}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => setRows((rs) => [...rs, { key: newKey(), code: "", label: "" }])}
        className="flex w-fit items-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-sm font-medium"
      >
        <Plus className="size-4" aria-hidden /> Thêm mục
      </button>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60">
          {pending ? "Đang lưu…" : "Lưu Checklist sơ bộ"}
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
