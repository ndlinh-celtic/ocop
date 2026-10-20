"use client";

import type { SubmissionBlocker } from "@ocop/core";
import { Send, Undo2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { dossierHome } from "@/lib/dossier-paths";
import { submitDossierAction, withdrawDossierAction, type DossierFormState } from "../actions";

/**
 * S16 Nộp hồ sơ (L03 CT-09, story 29): every reason the hồ sơ cannot be submitted yet, or the button that
 * submits it into the đợt Đang nhận nộp after confirmation. With `resubmission` (L04 CT-11) it nộp lại a
 * hồ sơ Yêu cầu bổ sung as the next Phiên bản nộp.
 */
export function SubmitPanel({
  dossierId,
  version,
  blockers,
  resubmission = false,
  onBehalf,
}: {
  dossierId: string;
  version: number;
  blockers: SubmissionBlocker[];
  resubmission?: boolean;
  /** Nhập hộ (L01): the Chủ thể the Cán bộ xã nộp for. */
  onBehalf?: string;
}) {
  const verb = resubmission ? "Nộp lại hồ sơ" : "Nộp hồ sơ";
  const [state, action, pending] = useActionState<DossierFormState, FormData>(submitDossierAction.bind(null, dossierId, version, onBehalf), {});
  return (
    <section className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-2 font-semibold">{verb}</h2>
      {blockers.length > 0 ? (
        <>
          <p className="mb-2 text-sm text-text-2">Chưa nộp được hồ sơ. Cần xử lý:</p>
          <ul className="mb-2 list-disc space-y-1 pl-5 text-sm text-danger">
            {blockers.map((b, i) => (
              <li key={i}>
                {b.message}
                {b.code === "round_version_mismatch" && (
                  <>
                    {" "}
                    <Link href={`${dossierHome(onBehalf)}/moi?tu=${dossierId}`} className="text-brand underline-offset-2 hover:underline">
                      Tạo hồ sơ mới từ hồ sơ này
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mb-3 text-sm text-text-2">
          Hồ sơ đủ điều kiện nộp. Tiêu chí chưa có minh chứng không chặn việc nộp; sau khi nộp, hồ sơ không sửa trực tiếp được.
        </p>
      )}
      <form
        action={action}
        onSubmit={(e) => {
          if (!window.confirm(`${verb} về UBND xã/phường? Sau khi nộp, hồ sơ không sửa trực tiếp được.`)) e.preventDefault();
        }}
      >
        <button
          type="submit"
          disabled={pending || blockers.length > 0}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink disabled:opacity-60"
        >
          <Send className="size-4" aria-hidden /> {verb}
        </button>
        {state.error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {state.error}
          </p>
        )}
      </form>
    </section>
  );
}

/** Story 33: rút a hồ sơ the xã has not Tiếp nhận yet, with a reason. */
export function WithdrawForm({ dossierId, version }: { dossierId: string; version: number }) {
  const [state, action, pending] = useActionState<DossierFormState, FormData>(withdrawDossierAction.bind(null, dossierId, version), {});
  return (
    <section className="rounded-lg border bg-surface p-4 shadow-card">
      <h2 className="mb-2 font-semibold">Rút hồ sơ</h2>
      <p className="mb-3 text-sm text-text-2">Rút được khi UBND xã/phường chưa tiếp nhận. Hồ sơ đã rút không nộp lại được; hãy sao chép sang hồ sơ mới nếu cần.</p>
      <form action={action} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Lý do rút
          <textarea name="reason" required maxLength={2000} rows={2} className="rounded-lg border border-line-strong bg-surface px-3 py-2" />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex w-fit items-center gap-2 rounded-lg border border-danger px-4 py-2 text-sm font-medium text-danger disabled:opacity-60"
        >
          <Undo2 className="size-4" aria-hidden /> Rút hồ sơ
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
      </form>
    </section>
  );
}
