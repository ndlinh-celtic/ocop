"use client";

import type { ProductField, ProductInfo } from "@ocop/core";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveProductAction } from "../actions";

const FIELDS: { name: ProductField; label: string; rows: number }[] = [
  { name: "productName", label: "Tên sản phẩm", rows: 1 },
  { name: "description", label: "Mô tả sản phẩm", rows: 4 },
  { name: "ingredients", label: "Nguyên liệu", rows: 3 },
  { name: "process", label: "Quy trình sản xuất", rows: 4 },
  { name: "packaging", label: "Bao bì, nhãn mác", rows: 3 },
  { name: "qualityDeclaration", label: "Công bố chất lượng", rows: 2 },
];

const AUTOSAVE_MS = 1200;

type Status = { kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string; conflict: boolean };

/**
 * Thông tin sản phẩm of a Nháp (stories 18, 19): saves itself a moment after each change and when a field
 * loses focus, carrying the version it last saw. If someone else changed the hồ sơ meanwhile, the save
 * is refused and the Chủ thể is asked to reload rather than overwrite.
 */
export function ProductForm({ dossierId, initial, version: initialVersion, editable }: { dossierId: string; initial: ProductInfo; version: number; editable: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const saved = useRef(initial);
  const version = useRef(initialVersion);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const latest = useRef(values);
  latest.current = values;

  async function save() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    await inFlight.current;
    const changed = Object.fromEntries(FIELDS.filter((f) => latest.current[f.name] !== saved.current[f.name]).map((f) => [f.name, latest.current[f.name]]));
    if (Object.keys(changed).length === 0) return;
    setStatus({ kind: "saving" });
    const snapshot = latest.current;
    const run = saveProductAction({ dossierId, expectedVersion: version.current, ...changed }).then((res) => {
      if ("version" in res) {
        version.current = res.version;
        saved.current = snapshot;
        setStatus({ kind: "saved" });
        // Other controls of the page (Xóa hồ sơ) act on the new version.
        router.refresh();
      } else {
        setStatus({ kind: "error", message: res.error, conflict: res.conflict });
      }
    });
    inFlight.current = run;
    await run;
  }

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  // Other editors of the page (kho minh chứng, tự chấm thử) bump the version too; follow the page's latest.
  useEffect(() => {
    version.current = Math.max(version.current, initialVersion);
  }, [initialVersion]);

  function change(name: ProductField, value: string) {
    setValues((v) => ({ ...v, [name]: value }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }

  const blocked = !editable || (status.kind === "error" && status.conflict);
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => (e.preventDefault(), void save())}>
      {FIELDS.map((f) => (
        <label key={f.name} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{f.label}</span>
          {f.rows === 1 ? (
            <input
              name={f.name}
              value={values[f.name]}
              disabled={blocked}
              onChange={(e) => change(f.name, e.target.value)}
              onBlur={() => void save()}
              className="rounded-lg border border-line-strong bg-surface px-3 py-2 disabled:opacity-70"
            />
          ) : (
            <textarea
              name={f.name}
              rows={f.rows}
              value={values[f.name]}
              disabled={blocked}
              onChange={(e) => change(f.name, e.target.value)}
              onBlur={() => void save()}
              className="rounded-lg border border-line-strong bg-surface px-3 py-2 disabled:opacity-70"
            />
          )}
        </label>
      ))}
      {editable && (
        <p role="status" aria-live="polite" className="text-sm text-text-3" data-testid="autosave-status">
          {status.kind === "saving" && "Đang lưu…"}
          {status.kind === "saved" && "Đã lưu tự động."}
          {status.kind === "idle" && "Thay đổi được lưu tự động."}
          {status.kind === "error" && (
            <span className="text-danger">
              {status.message}
              {status.conflict && (
                <button type="button" onClick={() => window.location.reload()} className="ml-2 font-medium text-brand underline">
                  Tải lại
                </button>
              )}
            </span>
          )}
        </p>
      )}
    </form>
  );
}
