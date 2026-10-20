"use client";

import { useActionState } from "react";
import { deleteDossierAction, type DossierFormState } from "../actions";

/** Story 26: deletes a Nháp after confirmation; a refusal shows inline. */
export function DeleteDossierButton({ dossierId, version }: { dossierId: string; version: number }) {
  const [state, action, pending] = useActionState<DossierFormState, FormData>(deleteDossierAction.bind(null, dossierId, version), {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Xóa hồ sơ Nháp này? Thao tác không hoàn tác được.")) e.preventDefault();
      }}
      className="flex flex-col gap-1"
    >
      <button type="submit" disabled={pending} className="rounded-lg border border-danger px-4 py-2 text-sm font-medium text-danger disabled:opacity-60">
        Xóa hồ sơ
      </button>
      {state.error && (
        <p role="alert" className="max-w-sm text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
