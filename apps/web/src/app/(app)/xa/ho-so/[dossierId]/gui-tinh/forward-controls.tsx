"use client";

import { Send, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, type FormEvent } from "react";
import { sendToStorage } from "@/lib/direct-upload";
import { attachSignedReportAction, forwardAction, requestSignedReportUploadAction } from "./actions";

/** Story 65: uploads the signed PDF straight to storage, then ties it to the hồ sơ; the scan runs after. */
export function SignedReportUploader({ dossierId, version, replacing }: { dossierId: string; version: number; replacing: boolean }) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const file = new FormData(formEl).get("file");
    if (!(file instanceof File) || file.size === 0) return setError("Chọn tệp PDF đã ký");
    setError(undefined);
    setProgress(0);
    try {
      const req = await requestSignedReportUploadAction({ fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size });
      if ("error" in req) throw new Error(req.error);
      const parts = await sendToStorage(file, req.upload, setProgress);
      const r = await attachSignedReportAction(dossierId, version, { fileId: req.fileId, parts });
      if (r.error) throw new Error(r.error);
      formEl.reset();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-medium">{replacing ? "Tải lên bản đã ký khác" : "Tải lên bản đã ký"} (PDF, sau khi ký số ngoài hệ thống)</span>
        <input name="file" type="file" accept="application/pdf,.pdf" required className="text-sm" />
      </label>
      <button
        type="submit"
        disabled={progress !== null}
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 font-semibold disabled:opacity-60"
      >
        <Upload className="size-4" aria-hidden /> {progress !== null ? `Đang tải ${Math.round(progress * 100)}%` : "Tải lên"}
      </button>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * Stories 66, 67: "Gửi lên tỉnh", locked with the reason while a condition is missing, and confirmed in a
 * dialog naming the hồ sơ, the đợt and who will be told.
 */
export function ForwardButton({
  dossierId,
  version,
  blockedReason,
  productName,
  roundName,
}: {
  dossierId: string;
  version: number;
  blockedReason: string | null;
  productName: string;
  roundName: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(forwardAction.bind(null, dossierId, version), {});
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={blockedReason !== null}
        onClick={() => dialog.current?.showModal()}
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-60"
      >
        <Send className="size-4" aria-hidden /> Gửi lên tỉnh
      </button>
      {blockedReason && <p className="text-sm text-text-3">{blockedReason}</p>}
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <dialog ref={dialog} className="m-auto max-w-md rounded-lg border bg-surface p-5 text-sm shadow-card backdrop:bg-black/40">
        <form action={action} className="flex flex-col gap-3" onSubmit={() => dialog.current?.close()}>
          <h2 className="text-base font-semibold">Gửi hồ sơ lên tỉnh?</h2>
          <p>
            Hồ sơ <b>{productName || "chưa đặt tên sản phẩm"}</b> của đợt <b>{roundName}</b> sẽ chuyển sang Đã chuyển tỉnh, kèm Phiên bản nộp mới nhất,
            Checklist sơ bộ và Báo cáo đánh giá cấp xã đã ký. Sau khi gửi, xã không sửa được Checklist sơ bộ nữa.
          </p>
          <p className="text-text-3">Hệ thống sẽ thông báo tới Sở Nông nghiệp và Môi trường và Chủ thể.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg border px-3 py-1.5">
              Hủy
            </button>
            <button type="submit" disabled={pending} className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-brand-ink disabled:opacity-60">
              {pending ? "Đang gửi…" : "Xác nhận gửi"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
