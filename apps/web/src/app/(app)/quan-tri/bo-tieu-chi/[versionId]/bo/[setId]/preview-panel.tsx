"use client";

import type { StoredStarRank, StoredUnmetMinimumStar } from "@ocop/core";
import { useRef, useState, useTransition } from "react";
import { previewSetAction } from "./preview-actions";

export interface PreviewCriterion {
  id: string;
  code: string;
  name: string;
  maxPoints: number;
  levels: { id: string; description: string; points: number; minimumStar: number | null; branch: string | null }[];
}

export interface PreviewPart {
  code: string;
  name: string;
  points: number;
  criteria: PreviewCriterion[];
}

const stars = (n: number) => (
  <>
    <span aria-hidden className="text-amber">
      {"★".repeat(n)}
    </span>
    <span className="sr-only">{n} sao</span>
  </>
);

/**
 * Chấm thử (L19 AD-03): Quản trị picks a Mức điểm per Tiêu chí of a draft Bộ tiêu chí and sees the Hạng sao.
 * Every change asks the server (core previewSet), which stays the source of truth; nothing is stored.
 */
export function PreviewPanel({ setId, parts }: { setId: string; parts: PreviewPart[] }) {
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [rank, setRank] = useState<StoredStarRank | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const latest = useRef(0);

  const choose = (criterionId: string, levelId: string) => {
    const next = { ...chosen };
    if (levelId) next[criterionId] = levelId;
    else delete next[criterionId];
    setChosen(next);
    const request = ++latest.current;
    start(async () => {
      const res = await previewSetAction(setId, Object.values(next));
      if (request !== latest.current) return;
      if ("rank" in res) {
        setRank(res.rank);
        setError(null);
      } else setError(res.error);
    });
  };

  const reset = () => {
    latest.current++;
    setChosen({});
    setRank(null);
    setError(null);
  };

  // Every unmet Sao tối thiểu is above the current Hạng sao, so each one keeps the Bộ from a higher rank.
  const blocking = new Map<string, StoredUnmetMinimumStar[]>();
  for (const u of rank?.unmet ?? []) blocking.set(u.criterionId, [...(blocking.get(u.criterionId) ?? []), u]);

  return (
    <details className="rounded-lg border bg-surface">
      <summary className="cursor-pointer px-4 py-3 font-medium">Chấm thử bản nháp</summary>
      <div className="flex flex-col gap-4 border-t px-4 py-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <p className="text-sm text-text-2">Chọn một mức cho từng tiêu chí để xem tổng điểm và Hạng sao. Tiêu chí chưa chọn tính 0 điểm. Không có gì được lưu.</p>
          {parts.map((part) => (
            <fieldset key={part.code} className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">
                Phần {part.code}. {part.name} ({part.points} điểm)
              </legend>
              {part.criteria.map((c) => {
                const blocks = blocking.get(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex flex-col gap-1 rounded-md p-2 text-sm sm:flex-row sm:items-center sm:justify-between ${blocks ? "bg-amber-soft ring-1 ring-amber" : "bg-surface-2"}`}
                  >
                    <span className="min-w-0">
                      {c.code} {c.name}
                      {blocks && (
                        <span className="ml-2 text-xs text-warning">
                          chặn {blocks.map((b) => `${b.star} sao (cần ${b.required})`).join(", ")}
                        </span>
                      )}
                    </span>
                    <select
                      value={chosen[c.id] ?? ""}
                      onChange={(e) => choose(c.id, e.target.value)}
                      className="w-full shrink-0 rounded-md border border-line-strong bg-surface px-2 py-1 sm:w-72"
                    >
                      <option value="">Chưa chọn (0 điểm)</option>
                      {c.levels.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.points}đ · {l.branch ? `${l.branch}. ` : ""}
                          {l.description}
                          {l.minimumStar ? ` (${l.minimumStar} sao)` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>

        <aside aria-live="polite" className="flex flex-col gap-3 rounded-md border border-line-strong p-4 text-sm lg:sticky lg:top-4 lg:w-72">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Kết quả chấm thử</h3>
            <button type="button" onClick={reset} className="text-xs text-text-3 underline">
              Chọn lại
            </button>
          </div>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          {!rank ? (
            <p className="text-text-3">{pending ? "Đang tính…" : "Chưa chọn mức nào."}</p>
          ) : (
            <>
              <table className="w-full">
                <tbody>
                  {rank.parts.map((p) => (
                    <tr key={p.code}>
                      <td className="py-0.5">Phần {p.code}</td>
                      <td className="py-0.5 text-right">{p.total}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-line font-semibold">
                    <td className="py-0.5">Tổng điểm</td>
                    <td className="py-0.5 text-right">{rank.total}</td>
                  </tr>
                </tbody>
              </table>
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                <dt className="text-text-2">Theo ngưỡng hạng</dt>
                <dd>{stars(rank.byThreshold)}</dd>
                <dt className="text-text-2">Theo Sao tối thiểu</dt>
                <dd>{stars(rank.byMinimumStars)}</dd>
                <dt className="font-semibold">Hạng sao</dt>
                <dd className="text-base">{stars(rank.star)}</dd>
              </dl>
              {rank.unmet.length > 0 && (
                <div>
                  <h4 className="font-medium">Yêu cầu chưa đạt</h4>
                  <ul className="mt-1 flex flex-col gap-1">
                    {rank.unmet.map((u) => (
                      <li key={`${u.criterionId}-${u.star}`} className="text-warning">
                        {u.code}: cần {u.required} điểm để đạt {u.star} sao (đang {u.actual})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {pending && <p className="text-xs text-text-3">Đang tính lại…</p>}
            </>
          )}
        </aside>
      </div>
    </details>
  );
}
