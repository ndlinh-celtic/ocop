"use client";

import { useActionState } from "react";
import { activateTemplateAction, type ActivateState } from "./actions";

/** Story 76: makes a phiên bản (or the mẫu mặc định, `versionId` empty) the mẫu đang dùng. */
export function ActivateButton({ kind, versionId, label }: { kind: string; versionId: string; label: string }) {
  const [state, action, pending] = useActionState<ActivateState, FormData>(activateTemplateAction, {});
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="versionId" value={versionId} />
      <button type="submit" disabled={pending} className="rounded-md bg-brand px-2 py-1 text-xs font-medium text-brand-ink disabled:opacity-60">
        {pending ? "Đang đổi…" : label}
      </button>
      {state.error && (
        <span role="alert" className="text-xs text-danger">
          {state.error}
        </span>
      )}
    </form>
  );
}
