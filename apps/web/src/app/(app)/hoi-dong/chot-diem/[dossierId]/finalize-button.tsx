"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useReauth } from "@/components/reauth-dialog";
import { finalizeAction } from "./finalize-actions";

const WORD = "CHỐT";

/**
 * S43 hộp thoại chốt (L15 HD-08, story 116): a danger dialog that says the points lock, shows the Hạng sao gợi ý,
 * asks to type CHỐT, then Xác thực lại when due. Disabled, with the reason, while the hồ sơ is in no open Phiên họp.
 */
export function FinalizeButton({ dossierId, version, star, total, blockedReason }: { dossierId: string; version: number; star: number; total: string; blockedReason: string | null }) {
  const { run, dialog } = useReauth();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const finalize = () =>
    start(() =>
      run(
        () => finalizeAction(dossierId, version),
        (outcome) => {
          setConfirming(false);
          setTyped("");
          if (outcome.finalized) router.refresh();
          else setError(outcome.error);
        },
      ),
    );
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={blockedReason !== null || pending}
        title={blockedReason ?? undefined}
        onClick={() => (setError(undefined), setConfirming(true))}
        className="inline-flex items-center gap-2 rounded-md bg-danger px-4 py-2 font-medium text-white disabled:opacity-60"
        data-testid="finalize"
      >
        <Lock className="size-4" aria-hidden /> Chốt điểm
      </button>
      {blockedReason && <p className="text-sm text-text-2">{blockedReason}</p>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {confirming && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--overlay)] p-4" role="dialog" aria-modal="true" aria-labelledby="finalize-title">
          <div className="w-full max-w-md rounded-lg border-t-4 border-danger bg-surface p-6 shadow-pop">
            <h2 id="finalize-title" className="mb-2 text-lg font-semibold">
              Chốt điểm hồ sơ này?
            </h2>
            <p className="mb-3 text-sm text-text-2">
              Sau khi chốt, điểm bị khóa và không sửa được trên giao diện. Phiếu chưa xác nhận sẽ ghi là Vắng và không tính vào điểm.
            </p>
            <p className="mb-4 text-sm">
              Hạng gợi ý: <b>{star} sao</b> · Tổng điểm <b>{total}</b>
            </p>
            <label className="mb-4 flex flex-col gap-1 text-sm">
              Gõ <b>{WORD}</b> để xác nhận
              <input value={typed} onChange={(e) => setTyped(e.target.value)} className="rounded-md border border-line-strong px-3 py-2" autoComplete="off" data-testid="finalize-word" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-line-strong px-4 py-2">
                Hủy
              </button>
              <button
                type="button"
                disabled={pending || typed.trim().toUpperCase() !== WORD}
                onClick={finalize}
                className="rounded-md bg-danger px-4 py-2 font-medium text-white disabled:opacity-60"
                data-testid="finalize-confirm"
              >
                {pending ? "Đang chốt…" : "Chốt điểm"}
              </button>
            </div>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}
