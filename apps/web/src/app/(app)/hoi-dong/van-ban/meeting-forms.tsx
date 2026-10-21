"use client";

import { useActionState } from "react";
import { addMeetingDossiersAction, closeMeetingAction, createMeetingAction, removeMeetingDossierAction, type MeetingFormState } from "./actions";

const field = "rounded-md border border-line-strong bg-surface px-3 py-2";

function Feedback({ state, saved }: { state: MeetingFormState; saved?: string }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {state.error}
      </p>
    );
  }
  return state.saved && saved ? (
    <p role="status" className="text-sm text-brand">
      {saved}
    </p>
  ) : null;
}

export interface Candidate {
  dossierId: string;
  code: string;
  productName: string;
}

function CandidateList({ candidates }: { candidates: Candidate[] }) {
  if (candidates.length === 0) return <p className="text-sm text-text-3">Không có hồ sơ Sẵn sàng chốt nào đang chờ Phiên họp.</p>;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {candidates.map((c) => (
        <li key={c.dossierId}>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="dossier" value={c.dossierId} />
            <span className="font-mono">{c.code}</span> {c.productName || "(Chưa đặt tên sản phẩm)"}
          </label>
        </li>
      ))}
    </ul>
  );
}

/** S44 (story 107): lập Phiên họp in a đợt of the Hội đồng, with hồ sơ Sẵn sàng chốt of that đợt. */
export function CreateMeetingForm({ rounds, candidates }: { rounds: { id: string; name: string }[]; candidates: (Candidate & { roundId: string | null })[] }) {
  const [state, action, pending] = useActionState<MeetingFormState, FormData>(createMeetingAction, {});
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card" data-testid="create-meeting">
      <h2 className="font-semibold">Lập Phiên họp</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Đợt
          <select name="roundId" className={field} required>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tiêu đề
          <input name="title" className={field} required maxLength={500} placeholder="Phiên họp thứ nhất" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Ngày họp
          <input type="date" name="heldOn" className={field} required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Địa điểm
          <input name="location" className={field} required maxLength={500} />
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Hồ sơ Sẵn sàng chốt</legend>
        <CandidateList candidates={candidates} />
      </fieldset>
      <div>
        <button type="submit" disabled={pending || rounds.length === 0} className="rounded-md bg-brand px-4 py-2 font-medium text-brand-ink disabled:opacity-60">
          Lập Phiên họp
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** Story 108: adds hồ sơ Sẵn sàng chốt of the đợt to an open Phiên họp. */
export function AddDossiersForm({ meetingId, candidates }: { meetingId: string; candidates: Candidate[] }) {
  const [state, action, pending] = useActionState<MeetingFormState, FormData>(addMeetingDossiersAction.bind(null, meetingId), {});
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="font-semibold">Thêm hồ sơ Sẵn sàng chốt</h2>
      <CandidateList candidates={candidates} />
      {candidates.length > 0 && (
        <div>
          <button type="submit" disabled={pending} className="rounded-md border border-line-strong px-4 py-2 font-medium disabled:opacity-60">
            Thêm vào Phiên họp
          </button>
        </div>
      )}
      <Feedback state={state} saved="Đã thêm hồ sơ." />
    </form>
  );
}

/** Story 108: gỡ one hồ sơ not yet chốt. */
export function RemoveDossierButton({ meetingId, dossierId }: { meetingId: string; dossierId: string }) {
  const [state, action, pending] = useActionState<MeetingFormState, FormData>(removeMeetingDossierAction.bind(null, meetingId, dossierId), {});
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <button type="submit" disabled={pending} className="text-sm text-danger disabled:opacity-60">
        Gỡ khỏi Phiên họp
      </button>
      <Feedback state={state} />
    </form>
  );
}

/** Kết thúc Phiên họp; refused while a hồ sơ still waits for chốt. */
export function CloseMeetingButton({ meetingId, pending: waiting }: { meetingId: string; pending: number }) {
  const [state, action, pending] = useActionState<MeetingFormState, FormData>(closeMeetingAction.bind(null, meetingId), {});
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={pending || waiting > 0}
        title={waiting > 0 ? `Còn ${waiting} hồ sơ chưa chốt điểm; chốt hoặc gỡ trước khi kết thúc` : undefined}
        className="rounded-md border border-line-strong px-4 py-2 font-medium disabled:opacity-60"
      >
        Kết thúc Phiên họp
      </button>
      <Feedback state={state} />
    </form>
  );
}
