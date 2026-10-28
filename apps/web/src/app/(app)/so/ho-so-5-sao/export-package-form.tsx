"use client";

import { Package } from "lucide-react";
import { useActionState } from "react";
import { exportPackageAction, type ExportPackageState } from "./actions";

/**
 * L17 SO-04 (#89, story 47): the button that exports the hồ sơ ticked in the list. The checkboxes sit in the table rows
 * and join this form through their `form` attribute, as each row already holds forms of its own.
 */
export function ExportPackageForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ExportPackageState, FormData>(exportPackageAction, {});
  return (
    <form id={id} action={action} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        <Package className="size-4" aria-hidden />
        {pending ? "Đang gửi yêu cầu…" : "Xuất gói đề nghị 5 sao"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.requested && !pending && (
        <p role="status" className="text-sm text-text-2">
          Đang tạo gói. Hệ thống sẽ báo trong mục Thông báo khi gói sẵn sàng tải về.
        </p>
      )}
    </form>
  );
}
