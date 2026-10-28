"use client";

import type { CertificateSettings } from "@ocop/core";
import { useActionState } from "react";
import { setCertificateSettingsAction, type CertificateSettingsState } from "./actions";

/** The settings of Giấy chứng nhận (story 35). */
export function CertificateSettingsForm({ settings }: { settings: CertificateSettings }) {
  const [state, action, pending] = useActionState<CertificateSettingsState, FormData>(setCertificateSettingsAction, {});
  const field = "rounded-md border border-line-strong bg-surface px-3 py-2";
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Đuôi số hiệu (số hiệu có dạng 012/2026/đuôi)
        <input name="codeSuffix" required maxLength={30} defaultValue={settings.codeSuffix} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Thời hạn hiệu lực (tháng, kể từ ngày ký quyết định)
        <input name="validityMonths" required inputMode="numeric" defaultValue={settings.validityMonths} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nhắc trước ngày hết hiệu lực (tháng)
        <input name="expiryReminderMonths" required inputMode="numeric" defaultValue={settings.expiryReminderMonths} className={field} />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.saved && !pending && <p className="text-sm text-text-2">Đã lưu cấu hình giấy chứng nhận.</p>}
      <div>
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-ink disabled:opacity-60">
          {pending ? "Đang lưu…" : "Lưu"}
        </button>
      </div>
    </form>
  );
}
