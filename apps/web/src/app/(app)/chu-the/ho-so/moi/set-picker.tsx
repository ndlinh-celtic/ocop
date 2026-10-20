"use client";

import type { TaxonomyGroup } from "@ocop/core";
import { TriangleAlert } from "lucide-react";
import { useActionState } from "react";
import { createDossierAction, type DossierFormState } from "../actions";

/**
 * Story 15, 17: picks one Bộ tiêu chí from Nhóm sản phẩm → Phân nhóm → Bộ tiêu chí, after a warning that
 * neither it nor the văn bản căn cứ can change later. With `sourceId`, the new hồ sơ is a copy.
 */
export function SetPicker({ productGroups, legalBasis, sourceId }: { productGroups: TaxonomyGroup[]; legalBasis: string; sourceId?: string }) {
  const [state, action, pending] = useActionState<DossierFormState, FormData>(createDossierAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      {sourceId && <input type="hidden" name="sourceId" value={sourceId} />}
      {productGroups.map((g) => (
        <fieldset key={g.id} className="rounded-lg border bg-surface p-4 shadow-card">
          <legend className="px-1 font-semibold">{g.name}</legend>
          {g.subgroups.map((s) => (
            <div key={s.id} className="mt-2">
              <p className="text-sm font-medium text-text-2">{s.name}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {s.sets.map((b) => (
                  <li key={b.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface-2">
                      <input type="radio" name="criteriaSetId" value={b.id} required />
                      <span>
                        {b.code && <span className="text-text-3">{b.code} · </span>}
                        {b.name}
                        <span className="ml-2 text-xs text-text-3">{b.criterionCount} tiêu chí</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </fieldset>
      ))}

      <div role="note" className="flex items-start gap-3 rounded-lg bg-amber-soft p-4 text-sm">
        <TriangleAlert className="size-5 shrink-0 text-amber" aria-hidden />
        <div className="flex flex-col gap-2">
          <p>
            Hồ sơ sẽ được chấm theo Bộ tiêu chí bạn chọn, căn cứ {legalBasis}. <b>Bộ tiêu chí và văn bản căn cứ không đổi được sau khi tạo.</b> Nếu chọn
            nhầm, hãy tạo hồ sơ mới.
          </p>
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" name="acknowledged" required /> Tôi đã hiểu
          </label>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <div>
        <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60">
          {sourceId ? "Sao chép sang hồ sơ mới" : "Tạo hồ sơ"}
        </button>
      </div>
    </form>
  );
}
