"use client";

import { PRELIMINARY_REJECTION_REASON_LABEL, PRELIMINARY_REJECTION_REASONS } from "@ocop/core";
import { ArrowRightLeft, Ban } from "lucide-react";
import { useActionState } from "react";
import type { WardDossierFormState } from "../actions";
import { rejectDossierAction, transferWardAction } from "../reject-transfer-actions";

const FIELD = "w-full max-w-xl rounded-lg border border-line-strong bg-surface px-3 py-2";

function ErrorLine({ state }: { state: WardDossierFormState }) {
  return state.error ? (
    <p role="alert" className="text-sm text-danger">
      {state.error}
    </p>
  ) : null;
}

/**
 * L05 XA-06 (story 63): loại to Không đạt sơ bộ, citing one Điều kiện loại of the hồ sơ's Bộ tiêu chí or
 * one Lý do loại sơ bộ; a Lý do needs a diễn giải.
 */
export function RejectForm({
  dossierId,
  version,
  exclusions,
}: {
  dossierId: string;
  version: number;
  exclusions: readonly { id: string; description: string }[];
}) {
  const [state, action, pending] = useActionState<WardDossierFormState, FormData>(rejectDossierAction.bind(null, dossierId, version), {});
  return (
    <section className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-2 font-semibold">Loại hồ sơ</h2>
      <p className="mb-3 text-sm text-text-2">Hồ sơ chuyển về Không đạt sơ bộ. Chủ thể được thông báo và thấy lý do loại.</p>
      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Căn cứ loại
          <select name="ground" required defaultValue="" className={FIELD}>
            <option value="" disabled>
              Chọn Điều kiện loại hoặc Lý do loại sơ bộ
            </option>
            {exclusions.length > 0 && (
              <optgroup label="Điều kiện loại của Bộ tiêu chí">
                {exclusions.map((e) => (
                  <option key={e.id} value={`dk:${e.id}`}>
                    {e.description}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Lý do loại sơ bộ">
              {PRELIMINARY_REJECTION_REASONS.map((r) => (
                <option key={r} value={`ly-do:${r}`}>
                  {PRELIMINARY_REJECTION_REASON_LABEL[r]}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Diễn giải (bắt buộc khi chọn Lý do loại sơ bộ)
          <textarea name="explanation" rows={3} maxLength={2000} className={FIELD} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex w-fit items-center gap-2 rounded-lg border border-danger px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60"
        >
          <Ban className="size-4" aria-hidden /> Loại hồ sơ
        </button>
        <ErrorLine state={state} />
      </form>
    </section>
  );
}

/** Chuyển xã (story 47): to the right xã/phường, with a reason; the hồ sơ then leaves this xã. */
export function TransferWardForm({ dossierId, version, wards }: { dossierId: string; version: number; wards: readonly { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<WardDossierFormState, FormData>(transferWardAction.bind(null, dossierId, version), {});
  return (
    <section className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-2 font-semibold">Chuyển xã</h2>
      <p className="mb-3 text-sm text-text-2">
        Hồ sơ không thuộc địa bàn được chuyển sang xã/phường đúng, mất Tiếp nhận và Cán bộ phụ trách. Sau khi chuyển, xã không còn thấy hồ sơ.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Xã/phường nhận
          <select name="wardId" required defaultValue="" className={FIELD}>
            <option value="" disabled>
              Chọn xã/phường
            </option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Lý do chuyển
          <textarea name="reason" required rows={2} maxLength={2000} className={FIELD} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex w-fit items-center gap-2 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          <ArrowRightLeft className="size-4" aria-hidden /> Chuyển xã
        </button>
        <ErrorLine state={state} />
      </form>
    </section>
  );
}
