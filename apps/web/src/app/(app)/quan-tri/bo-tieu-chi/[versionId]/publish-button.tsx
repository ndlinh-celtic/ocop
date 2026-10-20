"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useReauth } from "@/components/reauth-dialog";
import { publishVersionAction } from "./publish-actions";

/** L19 AD-04: publish after a confirmation and Xác thực lại; publishing cannot be undone. */
export function PublishButton({ versionId, disabled }: { versionId: string; disabled: boolean }) {
  const { run, dialog } = useReauth();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const publish = () =>
    start(() =>
      run(
        () => publishVersionAction(versionId),
        (outcome) => {
          setConfirming(false);
          if (outcome.published) router.refresh();
          else setError(outcome.error);
        },
      ),
    );
  return (
    <div className="ml-auto flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={disabled || pending}
        title={disabled ? "Sửa hết lỗi kiểm tra trước khi phát hành" : undefined}
        onClick={() => (setError(undefined), setConfirming(true))}
        className="rounded-md bg-brand px-4 py-2 font-medium text-brand-ink disabled:opacity-60"
      >
        Phát hành
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {confirming && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--overlay)] p-4" role="dialog" aria-modal="true" aria-labelledby="publish-title">
          <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-pop">
            <h2 id="publish-title" className="mb-2 text-lg font-semibold">
              Phát hành phiên bản tiêu chí?
            </h2>
            <p className="mb-4 text-sm text-text-2">
              Sau khi phát hành, phiên bản không sửa hay xóa được nữa và mọi người dùng đều xem được. Muốn thay đổi thì sao chép thành phiên bản mới.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-line-strong px-4 py-2">
                Hủy
              </button>
              <button type="button" disabled={pending} onClick={publish} className="rounded-md bg-brand px-4 py-2 font-medium text-brand-ink disabled:opacity-60">
                {pending ? "Đang phát hành…" : "Phát hành"}
              </button>
            </div>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}
