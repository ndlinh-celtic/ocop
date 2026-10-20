"use client";

import { Inbox, UserRoundCog } from "lucide-react";
import { useActionState } from "react";
import { changeHandlerAction, receiveDossierAction, type WardDossierFormState } from "../actions";

interface Officer {
  userId: string;
  fullName: string;
}

function OfficerSelect({ officers, selected }: { officers: Officer[]; selected: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      Cán bộ phụ trách
      <select name="handlerUserId" defaultValue={selected} className="w-full max-w-sm rounded-lg border border-line-strong bg-surface px-3 py-2">
        {officers.map((o) => (
          <option key={o.userId} value={o.userId}>
            {o.fullName}
          </option>
        ))}
      </select>
    </label>
  );
}

function Feedback({ state, saved }: { state: WardDossierFormState; saved: string }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {state.error}
      </p>
    );
  }
  return state.saved ? (
    <p role="status" className="text-sm text-brand">
      {saved}
    </p>
  ) : null;
}

/** L05 XA-02: Tiếp nhận, with the Cán bộ phụ trách preselected to the officer themself (story 40). */
export function ReceiveForm({ dossierId, version, officers, me }: { dossierId: string; version: number; officers: Officer[]; me: string }) {
  const [state, action, pending] = useActionState<WardDossierFormState, FormData>(receiveDossierAction.bind(null, dossierId, version), {});
  return (
    <section className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-2 font-semibold">Tiếp nhận hồ sơ</h2>
      <p className="mb-3 text-sm text-text-2">Sau khi tiếp nhận, Chủ thể không rút hồ sơ được nữa và được thông báo.</p>
      <form action={action} className="flex flex-col gap-3">
        <OfficerSelect officers={officers} selected={me} />
        <button type="submit" disabled={pending} className="flex w-fit items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60">
          <Inbox className="size-4" aria-hidden /> Tiếp nhận
        </button>
        <Feedback state={state} saved="Đã tiếp nhận hồ sơ." />
      </form>
    </section>
  );
}

/** L05 XA-03: another Cán bộ phụ trách, kept on the dòng thời gian (story 41). */
export function ChangeHandlerForm({ dossierId, version, officers, current }: { dossierId: string; version: number; officers: Officer[]; current: string | null }) {
  const [state, action, pending] = useActionState<WardDossierFormState, FormData>(changeHandlerAction.bind(null, dossierId, version), {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <OfficerSelect officers={officers} selected={current ?? ""} />
      <button
        type="submit"
        disabled={pending}
        className="flex w-fit items-center gap-2 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        <UserRoundCog className="size-4" aria-hidden /> Đổi Cán bộ phụ trách
      </button>
      <Feedback state={state} saved="Đã đổi Cán bộ phụ trách." />
    </form>
  );
}
