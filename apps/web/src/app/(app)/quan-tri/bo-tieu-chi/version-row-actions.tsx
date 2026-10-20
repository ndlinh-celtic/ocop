"use client";

import type { VersionStatus } from "@ocop/core";
import { Copy, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { copyVersionAction, deleteVersionAction } from "./version-actions";

/** L19 AD-04: Sao chép (any version) and Xóa (drafts only) on a row of the version list. */
export function VersionRowActions({ versionId, legalBasis, status }: { versionId: string; legalBasis: string; status: VersionStatus }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const copy = () =>
    start(async () => {
      setError(undefined);
      const outcome = await copyVersionAction(versionId);
      if ("error" in outcome) setError(outcome.error);
      else router.push(`/quan-tri/bo-tieu-chi/${outcome.versionId}`);
    });
  const remove = () =>
    start(async () => {
      const outcome = await deleteVersionAction(versionId);
      setConfirming(false);
      if ("error" in outcome) setError(outcome.error);
      else router.refresh();
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={copy}
          title="Tạo bản nháp mới từ phiên bản này"
          className="inline-flex items-center gap-1 rounded-md border border-line-strong px-3 py-1 disabled:opacity-60"
        >
          <Copy className="size-4" aria-hidden />
          Sao chép
        </button>
        {status === "draft" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => (setError(undefined), setConfirming(true))}
            className="inline-flex items-center gap-1 rounded-md border border-line-strong px-3 py-1 text-danger disabled:opacity-60"
          >
            <Trash2 className="size-4" aria-hidden />
            Xóa
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {confirming && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-[var(--overlay)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-${versionId}`}
        >
          <div className="w-full max-w-md rounded-lg bg-surface p-6 text-left shadow-pop">
            <h2 id={`delete-${versionId}`} className="mb-2 text-lg font-semibold">
              Xóa bản nháp {legalBasis}?
            </h2>
            <p className="mb-4 text-sm text-text-2">Toàn bộ cây tiêu chí của bản nháp này sẽ bị xóa và không khôi phục được.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-line-strong px-4 py-2">
                Hủy
              </button>
              <button type="button" disabled={pending} onClick={remove} className="rounded-md bg-danger px-4 py-2 font-medium text-white disabled:opacity-60">
                {pending ? "Đang xóa…" : "Xóa bản nháp"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
