"use client";

import type { AssignmentCandidate, AssignmentKind } from "@ocop/core";
import { UserPlus, UserRoundPen } from "lucide-react";
import { useActionState, useState } from "react";
import { addAssignmentAction, replaceAssignmentAction, type ReplaceFormState } from "./actions";

export interface CurrentPerson {
  userId: string;
  fullName: string;
  kind: AssignmentKind;
  /** Whether a thành viên chấm has xác nhận their phiếu; they can no longer be replaced (story 35). */
  confirmed: boolean;
}

type Candidates = { members: AssignmentCandidate[]; advisors: AssignmentCandidate[] };

const KIND_LABEL: Record<AssignmentKind, string> = { member: "Thành viên chấm", advisory: "Thành viên Tổ tư vấn" };
const field = "rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm";
const button = "inline-flex items-center gap-1.5 self-start rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-ink disabled:opacity-50";

/** S41 thay thành viên (L09 HD-03, stories 34 to 36): who goes, who takes over (same kind), and why. */
export function ReplaceForm(props: { dossierId: string; version: number; current: CurrentPerson[]; candidates: Candidates }) {
  const [state, action, pending] = useActionState<ReplaceFormState, FormData>(replaceAssignmentAction.bind(null, props.dossierId, props.version), {});
  const replaceable = props.current.filter((p) => !p.confirmed);
  const [userId, setUserId] = useState(replaceable[0]?.userId ?? "");
  const kind = props.current.find((p) => p.userId === userId)?.kind ?? "member";
  const taken = new Set(props.current.map((p) => p.userId));
  const pool = (kind === "member" ? props.candidates.members : props.candidates.advisors).filter((c) => !taken.has(c.userId));
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="flex items-center gap-2 font-medium">
        <UserRoundPen className="size-4" aria-hidden /> Thay thành viên
      </h2>
      <label className="flex flex-col gap-1 text-sm">
        Người bị thay
        <select name="userId" value={userId} onChange={(e) => setUserId(e.target.value)} className={field}>
          {replaceable.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.fullName} ({KIND_LABEL[p.kind]})
            </option>
          ))}
        </select>
      </label>
      {props.current.some((p) => p.confirmed) && <p className="text-xs text-text-3">Thành viên đã xác nhận phiếu không thay được.</p>}
      <label className="flex flex-col gap-1 text-sm">
        Người thay ({KIND_LABEL[kind]})
        <select name="newUserId" className={field} defaultValue="">
          <option value="" disabled>
            Chọn người
          </option>
          {pool.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.fullName}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Lý do
        <textarea name="reason" required maxLength={2000} rows={2} className={field} placeholder="Ví dụ: xung đột lợi ích đã khai báo bằng văn bản ngày …" />
      </label>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.saved && <p className="text-sm text-brand">Đã thay thành viên.</p>}
      <button type="submit" disabled={pending || replaceable.length === 0} className={button}>
        Thay
      </button>
    </form>
  );
}

/** S41 bổ sung thành viên (L09 HD-03, stories 36, 37): in force at once, with a Phiếu chấm trống for a thành viên chấm. */
export function AddForm(props: { dossierId: string; version: number; current: CurrentPerson[]; candidates: Candidates; advisoryMode: boolean }) {
  const [state, action, pending] = useActionState<ReplaceFormState, FormData>(addAssignmentAction.bind(null, props.dossierId, props.version), {});
  const taken = new Set(props.current.map((p) => p.userId));
  const groups: [AssignmentKind, AssignmentCandidate[]][] = [["member", props.candidates.members.filter((c) => !taken.has(c.userId))]];
  // Chấm trực tiếp has no Tổ tư vấn.
  if (props.advisoryMode) groups.push(["advisory", props.candidates.advisors.filter((c) => !taken.has(c.userId))]);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="flex items-center gap-2 font-medium">
        <UserPlus className="size-4" aria-hidden /> Bổ sung thành viên
      </h2>
      <label className="flex flex-col gap-1 text-sm">
        Người bổ sung
        <select name="person" className={field} defaultValue="">
          <option value="" disabled>
            Chọn người
          </option>
          {groups.map(([kind, people]) => (
            <optgroup key={kind} label={KIND_LABEL[kind]}>
              {people.map((c) => (
                <option key={c.userId} value={`${kind}:${c.userId}`}>
                  {c.fullName}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Lý do
        <textarea name="reason" required maxLength={2000} rows={2} className={field} placeholder="Ví dụ: thay cho thành viên vắng dài ngày" />
      </label>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.saved && <p className="text-sm text-brand">Đã bổ sung thành viên.</p>}
      <button type="submit" disabled={pending} className={button}>
        Bổ sung
      </button>
    </form>
  );
}
