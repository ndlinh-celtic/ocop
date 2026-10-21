"use client";

import { Inbox } from "lucide-react";
import { useActionState } from "react";
import { receiveAtProvinceAction, type ProvinceDossierFormState } from "../actions";

/** L08 SO-02 (stories 12, 15): Tiếp nhận tại tỉnh, after the quick check above it. */
export function ProvinceReceiveForm({ dossierId, version, councilMissing }: { dossierId: string; version: number; councilMissing: boolean }) {
  const [state, action, pending] = useActionState<ProvinceDossierFormState, FormData>(receiveAtProvinceAction.bind(null, dossierId, version), {});
  return (
    <form action={action} className="flex flex-col gap-2">
      {councilMissing && (
        <p role="status" className="text-sm font-medium text-amber">
          Đợt của hồ sơ chưa có Hội đồng. Gán Hội đồng cho đợt trước khi tiếp nhận.
        </p>
      )}
      <button
        type="submit"
        disabled={pending || councilMissing}
        className="flex w-fit items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60"
      >
        <Inbox className="size-4" aria-hidden /> Tiếp nhận tại tỉnh
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p role="status" className="text-sm text-brand">
          Đã tiếp nhận hồ sơ tại tỉnh.
        </p>
      )}
    </form>
  );
}
