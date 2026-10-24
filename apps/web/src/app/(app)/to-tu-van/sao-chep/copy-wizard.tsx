"use client";

import { DOSSIER_STATE_LABEL, type AdvisoryCopyBoardRow, type AdvisoryCopyPlan, type CopySheetOutcome } from "@ocop/core";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { copyAdvisoryAction, previewAdvisoryCopyAction, type CopyRequest } from "./actions";

const OUTCOME: Record<CopySheetOutcome, string> = {
  new: "Phiếu mới sẽ được điền sẵn",
  update: "Cập nhật Tiêu chí chưa chỉnh",
  confirmed: "Bỏ qua: phiếu đã xác nhận",
  absent: "Bỏ qua: thành viên vắng",
  none: "Bỏ qua: chưa có Phiếu chấm",
};
const STEPS = ["Chọn hồ sơ và phiên bản", "Phạm vi và người nhận", "Xem trước và xác nhận"];

/**
 * S53 (L12): the three steps of the sao chép. (1) hồ sơ and phiên bản, newest by default; (2) Toàn bộ or chosen Tiêu
 * chí, grouped by Phần, and Tất cả or chosen thành viên chấm; (3) the xem trước per hồ sơ × thành viên, then Xác nhận
 * sao chép, whose result lists what was kept so the Tổ tư vấn can tell the thành viên.
 */
export function CopyWizard({ rows }: { rows: AdvisoryCopyBoardRow[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [versionOf, setVersionOf] = useState<Record<string, string>>({});
  const [allCriteria, setAllCriteria] = useState(true);
  const [codes, setCodes] = useState<Set<string>>(new Set());
  const [allRecipients, setAllRecipients] = useState(true);
  const [people, setPeople] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<AdvisoryCopyPlan[]>();
  const [done, setDone] = useState<AdvisoryCopyPlan[]>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const chosen = rows.filter((r) => picked.has(r.dossierId));
  // The Tiêu chí and thành viên chấm across the hồ sơ chosen, each once.
  const criteria = useMemo(() => [...new Map(chosen.flatMap((r) => r.criteria).map((c) => [c.code, c])).values()], [chosen]);
  const members = useMemo(() => [...new Map(chosen.flatMap((r) => r.members).map((m) => [m.userId, m])).values()], [chosen]);
  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const request = (): CopyRequest => ({
    dossiers: chosen.map((r) => ({ dossierId: r.dossierId, expectedVersion: r.dossierVersion, advisoryVersionId: versionOf[r.dossierId] ?? r.versions.at(-1)!.id })),
    criteria: allCriteria ? "all" : [...codes],
    recipients: allRecipients ? "all" : [...people],
  });

  async function call(action: typeof previewAdvisoryCopyAction, then: (dossiers: AdvisoryCopyPlan[]) => void) {
    setPending(true);
    setError(undefined);
    try {
      const res = await action(request());
      if ("error" in res) setError(res.error);
      else then(res.dossiers);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    const again = () => {
      setDone(undefined);
      setPlan(undefined);
      setPicked(new Set());
      setStep(0);
      router.refresh();
    };
    return <CopyResult plans={done} onAgain={again} />;
  }

  const canNext = step === 0 ? chosen.length > 0 : (allCriteria || codes.size > 0) && (allRecipients || people.size > 0);

  return (
    <section className="flex flex-col gap-4" aria-label="Sao chép sang phiếu chấm">
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, i) => (
          <li key={label} className={`rounded-full px-3 py-1 ${i === step ? "bg-brand text-brand-ink" : "bg-surface-2 text-text-2"}`} aria-current={i === step ? "step" : undefined}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="rounded-lg border border-danger px-4 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {step === 0 && (
        <div className="overflow-x-auto rounded-lg border bg-surface shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-text-2">
              <tr>
                <th className="p-2" scope="col">
                  <span className="sr-only">Chọn</span>
                </th>
                <th className="p-2" scope="col">Hồ sơ</th>
                <th className="p-2" scope="col">Trạng thái</th>
                <th className="p-2" scope="col">Phiên bản</th>
                <th className="p-2" scope="col">Sao chép</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.dossierId} className="border-t">
                  <td className="p-2">
                    <input type="checkbox" aria-label={`Chọn hồ sơ ${r.code}`} checked={picked.has(r.dossierId)} onChange={() => setPicked(toggle(picked, r.dossierId))} />
                  </td>
                  <td className="p-2">
                    <span className="font-mono">{r.code}</span> {r.productName}
                  </td>
                  <td className="p-2">{DOSSIER_STATE_LABEL[r.state]}</td>
                  <td className="p-2">
                    <select
                      aria-label={`Phiên bản báo cáo của hồ sơ ${r.code}`}
                      value={versionOf[r.dossierId] ?? r.versions.at(-1)!.id}
                      onChange={(e) => setVersionOf({ ...versionOf, [r.dossierId]: e.target.value })}
                      className="rounded-md border px-2 py-1"
                    >
                      {[...r.versions].reverse().map((v, i) => (
                        <option key={v.id} value={v.id}>
                          Phiên bản {v.number}
                          {i === 0 ? " (mới nhất)" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 text-text-2">{r.copiedNumber === null ? "Chưa" : `Đã sao chép phiên bản ${r.copiedNumber}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 md:grid-cols-2">
          <fieldset className="rounded-lg border bg-surface p-4 shadow-card">
            <legend className="px-1 font-semibold">Phạm vi</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={allCriteria} onChange={() => setAllCriteria(true)} /> Toàn bộ Tiêu chí
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={!allCriteria} onChange={() => setAllCriteria(false)} /> Chọn Tiêu chí
            </label>
            {!allCriteria &&
              [...new Set(criteria.map((c) => c.partCode))].map((part) => (
                <div key={part} className="mt-2">
                  <p className="text-sm font-medium">Phần {part}</p>
                  {criteria
                    .filter((c) => c.partCode === part)
                    .map((c) => (
                      <label key={c.code} className="ml-2 flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={codes.has(c.code)} onChange={() => setCodes(toggle(codes, c.code))} />
                        <span className="font-mono">{c.code}</span> {c.name}
                      </label>
                    ))}
                </div>
              ))}
          </fieldset>
          <fieldset className="rounded-lg border bg-surface p-4 shadow-card">
            <legend className="px-1 font-semibold">Người nhận</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={allRecipients} onChange={() => setAllRecipients(true)} /> Tất cả thành viên được Phân công
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={!allRecipients} onChange={() => setAllRecipients(false)} /> Chọn từng người
            </label>
            {!allRecipients &&
              members.map((m) => (
                <label key={m.userId} className="ml-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={people.has(m.userId)} onChange={() => setPeople(toggle(people, m.userId))} />
                  {m.fullName}
                  {m.sheet === "confirmed" && <span className="text-text-3">(đã xác nhận)</span>}
                </label>
              ))}
          </fieldset>
        </div>
      )}

      {step === 2 && plan && <CopyPreview plans={plan} />}

      <div className="flex justify-between gap-2">
        <button type="button" disabled={step === 0 || pending} onClick={() => setStep(step - 1)} className="rounded-md border border-line-strong px-4 py-2 disabled:opacity-60">
          Quay lại
        </button>
        {step < 2 ? (
          <button
            type="button"
            disabled={!canNext || pending}
            onClick={() =>
              step === 0
                ? setStep(1)
                : void call(previewAdvisoryCopyAction, (dossiers) => {
                    setPlan(dossiers);
                    setStep(2);
                  })
            }
            className="rounded-md bg-brand px-4 py-2 font-medium text-brand-ink disabled:opacity-60"
          >
            {step === 0 ? "Tiếp tục" : pending ? "Đang tính…" : "Xem trước"}
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => void call(copyAdvisoryAction, setDone)} className="rounded-md bg-brand px-4 py-2 font-medium text-brand-ink disabled:opacity-60">
            {pending ? "Đang sao chép…" : "Xác nhận sao chép"}
          </button>
        )}
      </div>
    </section>
  );
}

function CopyPreview({ plans }: { plans: AdvisoryCopyPlan[] }) {
  const sheets = plans.flatMap((p) => p.recipients);
  const count = (o: CopySheetOutcome[]) => sheets.filter((r) => o.includes(r.sheet)).length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" data-testid="copy-summary">
        {count(["new"])} phiếu mới, {count(["update"])} phiếu cập nhật, {count(["confirmed", "absent", "none"])} phiếu bỏ qua; {plans.reduce((n, p) => n + p.written, 0)} Tiêu chí sẽ được điền.
      </p>
      {plans.map((p) => (
        <article key={p.dossierId} className="rounded-lg border bg-surface p-4 shadow-card">
          <h3 className="font-medium">
            <span className="font-mono">{p.code}</span> {p.productName} · phiên bản {p.advisoryVersion.number}
          </h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {p.recipients.map((r) => {
              const skipped = r.sheet !== "new" && r.sheet !== "update";
              return (
                <li key={r.userId} className={skipped || r.edited.length > 0 ? "text-amber" : undefined}>
                  <b>{r.fullName}</b>: {OUTCOME[r.sheet]}
                  {!skipped && r.written.length > 0 && ` (${r.written.join(", ")})`}
                  {r.edited.length > 0 && ` · Bỏ qua Tiêu chí thành viên đã chỉnh: ${r.edited.join(", ")}`}
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </div>
  );
}

function CopyResult({ plans, onAgain }: { plans: AdvisoryCopyPlan[]; onAgain: () => void }) {
  const skipped = plans.flatMap((p) => p.skipped.map((s) => ({ ...s, code: p.code })));
  return (
    <section className="flex flex-col gap-3" aria-label="Kết quả sao chép">
      <p role="status" className="rounded-lg border border-brand bg-brand-soft px-4 py-2 text-sm text-brand">
        Đã sao chép {plans.reduce((n, p) => n + p.written, 0)} Tiêu chí vào Phiếu chấm của {plans.length} hồ sơ. Thành viên có Tiêu chí được điền đã nhận thông báo.
      </p>
      {skipped.length > 0 && (
        <div className="rounded-lg border bg-surface p-4 shadow-card">
          <h3 className="mb-1 font-medium">Được giữ nguyên, nên báo lại cho thành viên</h3>
          <ul className="text-sm">
            {skipped.map((s) => (
              <li key={`${s.code}-${s.userId}-${s.criterion ?? "sheet"}`}>
                <span className="font-mono">{s.code}</span> · {s.fullName}: {s.criterion ? `Tiêu chí ${s.criterion} đã chỉnh` : OUTCOME[s.reason as CopySheetOutcome]}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" onClick={onAgain} className="self-start rounded-md border border-line-strong px-4 py-2">
        Sao chép tiếp
      </button>
    </section>
  );
}
