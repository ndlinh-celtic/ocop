"use client";

import type { AssignmentCandidate, AssignmentKind } from "@ocop/core";
import { Save, Send } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { useFlash } from "@/components/flash";
import { editAssignmentsAction, startGradingAction, type AssignmentFormState, type StartGradingFormState } from "./actions";

export interface BoardRow {
  dossierId: string;
  version: number;
  code: string;
  productName: string;
  entityName: string;
  productGroup: string | null;
  roundName: string | null;
  gradingMode: string | null;
  minGraders: number | null;
  /** Tiếp nhận tại tỉnh in the current lượt gửi tỉnh; until then the Phân công cannot change. */
  received: boolean;
  assignments: { userId: string; fullName: string; kind: AssignmentKind; inForce: boolean }[];
}

const chip = "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

/**
 * S41 (L09 HD-02, stories 25 to 29): check one or more hồ sơ, pick thành viên chấm and Thành viên Tổ tư
 * vấn, save the same Phân công nháp on all of them. Checking a single hồ sơ loads its Phân công into the
 * pickers, so it can be edited. One person in both lists is refused by the server (story 28) and flagged here.
 */
export function AssignmentBoard({ rows, candidates }: { rows: BoardRow[]; candidates: { members: AssignmentCandidate[]; advisors: AssignmentCandidate[] } }) {
  const [state, action, pending] = useActionState<AssignmentFormState, FormData>(editAssignmentsAction, {});
  const flash = useFlash();
  // The board goes with its last hồ sơ, so the Giao chấm message is a flash outside it.
  const [started, startAction, starting] = useActionState<StartGradingFormState, FormData>(async (prev, form) => {
    const result = await startGradingAction(prev, form);
    if (result.started !== undefined) flash(`Đã Giao chấm ${result.started} hồ sơ.`);
    return result;
  }, {});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [advisors, setAdvisors] = useState<Set<string>>(new Set());

  const editable = rows.filter((r) => r.received);
  // Chip tải công việc: how many of the listed hồ sơ each person is on.
  const load = new Map<string, number>();
  for (const r of rows) for (const a of r.assignments) load.set(a.userId, (load.get(a.userId) ?? 0) + 1);

  function choose(next: Set<string>) {
    setSelected(next);
    if (next.size === 1) {
      const row = rows.find((r) => next.has(r.dossierId))!;
      setMembers(new Set(row.assignments.filter((a) => a.kind === "member").map((a) => a.userId)));
      setAdvisors(new Set(row.assignments.filter((a) => a.kind === "advisory").map((a) => a.userId)));
    }
  }
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };
  const conflict = [...members].filter((id) => advisors.has(id));
  // The payload comes from state, not from the form: React resets a form after its action ran, which unchecks
  // these controlled checkboxes in the DOM while the state still has them, so a Giao chấm right after a save
  // would send no hồ sơ. Each hồ sơ goes with the version the page shows now.
  const payload = () => {
    const form = new FormData();
    for (const r of rows) if (selected.has(r.dossierId)) form.append("dossier", `${r.dossierId}:${r.version}`);
    for (const id of members) form.append("member", id);
    for (const id of advisors) form.append("advisor", id);
    return form;
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => action(payload()));
      }}
      className="grid gap-6 lg:grid-cols-[1fr_20rem]"
    >
      <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface-2">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Chọn mọi hồ sơ"
                  checked={editable.length > 0 && editable.every((r) => selected.has(r.dossierId))}
                  onChange={(e) => choose(e.target.checked ? new Set(editable.map((r) => r.dossierId)) : new Set())}
                />
              </th>
              <th className="px-3 py-2">Mã hồ sơ</th>
              <th className="px-3 py-2">Sản phẩm</th>
              <th className="px-3 py-2">Nhóm</th>
              <th className="px-3 py-2">Tổ tư vấn phụ trách</th>
              <th className="px-3 py-2">Thành viên chấm</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const graders = r.assignments.filter((a) => a.kind === "member");
              const short = r.minGraders !== null && graders.length < r.minGraders;
              return (
                <tr key={r.dossierId} className="border-b align-top last:border-0" data-testid="assignment-row">
                  <td className="px-3 py-2">
                    {r.received ? (
                      <input
                        type="checkbox"
                        name="dossier"
                        value={`${r.dossierId}:${r.version}`}
                        aria-label={`Chọn ${r.code}`}
                        checked={selected.has(r.dossierId)}
                        onChange={() => choose(toggle(selected, r.dossierId))}
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{r.code}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.productName || "(Chưa đặt tên sản phẩm)"}</div>
                    <div className="text-xs text-text-3">
                      {r.entityName}
                      {r.roundName ? ` · ${r.roundName}` : ""}
                      {r.gradingMode ? ` · ${r.gradingMode}` : ""}
                    </div>
                    {!r.received && <span className={`${chip} mt-1 inline-block bg-amber-soft text-amber`}>Chờ Sở tiếp nhận lại</span>}
                  </td>
                  <td className="px-3 py-2">{r.productGroup ?? "—"}</td>
                  <td className="px-3 py-2">
                    <People list={r.assignments.filter((a) => a.kind === "advisory")} />
                  </td>
                  <td className={`px-3 py-2 ${short ? "border-l-2 border-amber" : ""}`}>
                    <People list={graders} />
                    {short && (
                      <p className="mt-1 text-xs text-amber">
                        {graders.length}/{r.minGraders} người chấm tối thiểu
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <aside className="flex flex-col gap-4 rounded-lg border bg-surface p-4 shadow-card">
        <h2 className="font-semibold">Phân công cho {selected.size} hồ sơ đã chọn</h2>
        <Picker
          title="Thành viên chấm"
          name="member"
          people={candidates.members}
          chosen={members}
          load={load}
          onToggle={(id) => setMembers(toggle(members, id))}
          empty="Hội đồng chưa có Thành viên hội đồng còn hiệu lực."
        />
        <Picker
          title="Thành viên Tổ tư vấn"
          name="advisor"
          people={candidates.advisors}
          chosen={advisors}
          load={load}
          onToggle={(id) => setAdvisors(toggle(advisors, id))}
          empty="Hội đồng chưa có Thành viên Tổ tư vấn còn hiệu lực."
        />
        {conflict.length > 0 && (
          <p role="alert" className="text-sm text-danger">
            Một người không thể vừa là Thành viên Tổ tư vấn vừa là thành viên chấm của cùng hồ sơ.
          </p>
        )}
        <button
          type="submit"
          disabled={pending || selected.size === 0 || conflict.length > 0}
          className="flex w-fit items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60"
        >
          <Save className="size-4" aria-hidden /> Lưu Phân công nháp
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.saved !== undefined && !pending && (
          <p role="status" className="text-sm text-brand">
            Đã lưu Phân công nháp cho {state.saved} hồ sơ.
          </p>
        )}
        <div className="flex flex-col gap-2 border-t pt-4">
          <h2 className="font-semibold">Giao chấm</h2>
          <p className="text-xs text-text-2">
            Giao chấm theo Phân công đã lưu của {selected.size} hồ sơ đã chọn, theo Chế độ chấm của đợt. Người được Phân công nhận thông báo và bắt đầu thấy hồ
            sơ.
          </p>
          <button
            type="button"
            disabled={starting || pending || selected.size === 0}
            onClick={() => {
              if (window.confirm(`Giao chấm ${selected.size} hồ sơ? Sau Giao chấm, Chế độ chấm và Quy tắc tổng hợp của đợt không đổi được nữa.`)) {
                startTransition(() => startAction(payload()));
              }
            }}
            className="flex w-fit items-center gap-2 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand disabled:opacity-60"
          >
            <Send className="size-4" aria-hidden /> Giao chấm
          </button>
          {started.error && (
            <p role="alert" className="text-sm text-danger">
              {started.error}
            </p>
          )}
        </div>
      </aside>
    </form>
  );
}

function People({ list }: { list: { userId: string; fullName: string; inForce: boolean }[] }) {
  if (list.length === 0) return <span className="text-text-3">Chưa phân công</span>;
  return (
    <ul className="flex flex-col gap-1">
      {list.map((a) => (
        <li key={a.userId} className="flex flex-wrap items-center gap-1">
          {a.fullName}
          <span className={`${chip} ${a.inForce ? "bg-brand-soft text-brand" : "bg-surface-2 text-text-2"}`}>{a.inForce ? "Đã giao chấm" : "Nháp"}</span>
        </li>
      ))}
    </ul>
  );
}

function Picker(props: {
  title: string;
  name: string;
  people: AssignmentCandidate[];
  chosen: Set<string>;
  load: Map<string, number>;
  onToggle: (id: string) => void;
  empty: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">
        {props.title} ({props.chosen.size})
      </legend>
      {props.people.length === 0 ? (
        <p className="text-sm text-text-3">{props.empty}</p>
      ) : (
        props.people.map((p) => (
          <label key={p.userId} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={props.name} value={p.userId} checked={props.chosen.has(p.userId)} onChange={() => props.onToggle(p.userId)} />
            <span className="flex-1">{p.fullName}</span>
            <span className={`${chip} bg-surface-2 text-text-2`} title="Số hồ sơ đang phân công trong danh sách">
              {props.load.get(p.userId) ?? 0}
            </span>
          </label>
        ))
      )}
    </fieldset>
  );
}
