"use client";

import { ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { reauthAction, type ReauthNeeded } from "@/server/reauth";

/**
 * Wraps a sensitive action: if the server answers that Xác thực lại is due, asks for the TOTP code
 * (or the password when TOTP is not mandatory), then runs the action again.
 */
export function useReauth() {
  const [need, setNeed] = useState<(ReauthNeeded & { retry: () => void }) | null>(null);
  const run = async <T,>(action: () => Promise<{ ok: true; value: T } | ReauthNeeded>, onDone: (v: T) => void) => {
    const result = await action();
    if ("reauth" in result) setNeed({ ...result, retry: () => void run(action, onDone) });
    else onDone(result.value);
  };
  const dialog = need && <ReauthDialog method={need.method} onCancel={() => setNeed(null)} onSuccess={() => (setNeed(null), need.retry())} />;
  return { run, dialog };
}

function ReauthDialog({ method, onCancel, onSuccess }: { method: "totp" | "password"; onCancel: () => void; onSuccess: () => void }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const submit = (form: FormData) =>
    start(async () => {
      const value = String(form.get("proof") ?? "");
      const result = await reauthAction(method === "totp" ? { code: value } : { password: value });
      if (result.ok) onSuccess();
      else setError(result.error);
    });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--overlay)] p-4" role="dialog" aria-modal="true" aria-labelledby="reauth-title">
      <form action={submit} className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-pop">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="size-5 text-brand" aria-hidden />
          <h2 id="reauth-title" className="text-lg font-semibold">
            Xác thực lại
          </h2>
        </div>
        <p className="mb-4 text-sm text-text-2">
          Thao tác này cần xác nhận lại danh tính. {method === "totp" ? "Nhập mã 6 số trên ứng dụng xác thực." : "Nhập mật khẩu của bạn."}
        </p>
        <input
          name="proof"
          type={method === "totp" ? "text" : "password"}
          inputMode={method === "totp" ? "numeric" : undefined}
          autoComplete={method === "totp" ? "one-time-code" : "current-password"}
          aria-label={method === "totp" ? "Mã xác thực" : "Mật khẩu"}
          required
          autoFocus
          className="mb-3 w-full rounded-md border border-line-strong bg-surface px-3 py-2"
        />
        {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border px-4 py-2">
            Hủy
          </button>
          <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60">
            Xác nhận
          </button>
        </div>
      </form>
    </div>
  );
}
