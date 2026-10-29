"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { amendDecisionAction } from "./amend-actions";

/**
 * L16 HD-11 (#84, stories 17, 18): corrects the số or ngày ký of the recorded quyết định, with a lý do. The giấy chứng
 * nhận keep their số hiệu; their ngày cấp and hết hiệu lực follow, and the bản nháp still Chờ ký are generated again.
 */
export function AmendDecisionForm({ decisionId, number, signedOn }: { decisionId: string; number: string; signedOn: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(undefined);
    const r = await amendDecisionAction(decisionId, {
      number: String(form.get("number") ?? ""),
      signedOn: String(form.get("signedOn") ?? ""),
      reason: String(form.get("reason") ?? ""),
    });
    setBusy(false);
    if (r.error) return setError(r.error);
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-fit rounded-md border px-3 py-1 text-sm">
        Sửa số hoặc ngày ký
      </button>
    );
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 text-sm" aria-label="Sửa số hoặc ngày ký quyết định">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Số quyết định</span>
          <input name="number" required maxLength={100} defaultValue={number} className="rounded-md border border-line-strong px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Ngày ký</span>
          <input name="signedOn" type="date" required defaultValue={signedOn} className="rounded-md border border-line-strong px-2 py-1.5" />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Lý do sửa</span>
        <input name="reason" required maxLength={1000} className="rounded-md border border-line-strong px-2 py-1.5" />
      </label>
      <p className="text-text-3">Không đổi được ngày ký sang năm khác. Số hiệu giấy chứng nhận giữ nguyên; ngày cấp và ngày hết hiệu lực được tính lại.</p>
      <span className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white disabled:opacity-60">
          {busy ? "Đang lưu..." : "Lưu"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-1.5">
          Hủy
        </button>
      </span>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
