"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importVersionAction, type ImportState } from "./actions";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importVersionAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Tệp JSON (định dạng bóc tách QĐ 26)
          <input name="file" type="file" accept="application/json,.json" required className="rounded-md border border-line-strong bg-surface px-3 py-2" />
        </label>
        <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60">
          {pending ? "Đang nhập…" : "Nhập thành bản nháp"}
        </button>
      </div>
      {state.error && (
        <div role="alert" className="text-sm text-danger">
          <p>{state.error}</p>
          {state.issues && state.issues.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {state.issues.map((i, n) => (
                <li key={n}>
                  <span className="font-medium">{i.location}</span>: {i.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state.versionId && (
        <p role="status" className="text-sm text-brand">
          Đã tạo bản nháp.{" "}
          <Link href={`/quan-tri/bo-tieu-chi/${state.versionId}`} className="font-medium underline">
            Mở bản nháp
          </Link>
        </p>
      )}
    </form>
  );
}
