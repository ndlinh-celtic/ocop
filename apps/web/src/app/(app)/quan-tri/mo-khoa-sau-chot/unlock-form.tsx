"use client";

import { LockOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useReauth } from "@/components/reauth-dialog";
import { sendToStorage } from "@/lib/direct-upload";
import { completeUnlockFileUploadAction, requestUnlockFileUploadAction, unlockAction } from "./actions";

const input = "rounded-md border border-line-strong bg-surface px-3 py-2";
const label = "flex flex-col gap-1 text-sm font-medium";

/**
 * L15 Mở khóa sau chốt (stories 127 to 129): the văn bản yêu cầu of the Hội đồng (PDF), người yêu cầu and lý do, then a
 * danger dialog that asks to type the mã hồ sơ, then Xác thực lại when due. The file is uploaded once, before the
 * dialog, so a Xác thực lại does not upload it again.
 */
export function UnlockForm({ dossierId, code }: { dossierId: string; code: string }) {
  const { run, dialog } = useReauth();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState<{ requestFileId: string; requestedBy: string; reason: string } | null>(null);
  const [typed, setTyped] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  async function prepare(form: FormData) {
    setError(undefined);
    const file = form.get("file");
    const requestedBy = String(form.get("requestedBy") ?? "").trim();
    const reason = String(form.get("reason") ?? "").trim();
    if (!(file instanceof File) || file.size === 0) return setError("Tải lên văn bản yêu cầu của Hội đồng (PDF)");
    if (!requestedBy || !reason) return setError("Ghi người yêu cầu và lý do Mở khóa");
    try {
      setProgress(0);
      const req = await requestUnlockFileUploadAction({ fileName: file.name, contentType: file.type || "application/pdf", size: file.size });
      if ("error" in req) throw new Error(req.error);
      const parts = await sendToStorage(file, req.upload, setProgress);
      const done = await completeUnlockFileUploadAction(req.fileId, parts);
      if (done.error) throw new Error(done.error);
      setFields({ requestFileId: req.fileId, requestedBy, reason });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải lên được tệp");
    } finally {
      setProgress(null);
    }
  }

  const unlock = () =>
    start(() =>
      run(
        () => unlockAction({ dossierId, ...fields! }),
        (outcome) => {
          setFields(null);
          setTyped("");
          if (outcome.unlocked) {
            formRef.current?.reset();
            router.refresh();
          } else setError(outcome.error);
        },
      ),
    );

  return (
    <form ref={formRef} action={prepare} className="flex flex-col gap-3">
      <label className={label}>
        Văn bản yêu cầu của Hội đồng
        <input name="file" type="file" accept="application/pdf,.pdf" required className="text-sm" />
        <span className="text-xs font-normal text-text-3">PDF đã ký; tệp được quét mã độc trước khi dùng</span>
      </label>
      <label className={label}>
        Người yêu cầu
        <input name="requestedBy" required maxLength={2000} placeholder="Họ tên, chức vụ trong Hội đồng" className={input} />
      </label>
      <label className={label}>
        Lý do
        <textarea name="reason" required maxLength={2000} rows={3} className={input} />
      </label>
      {progress !== null && (
        <div
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 overflow-hidden rounded-full bg-surface-3"
        >
          <div className="h-full bg-brand transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={progress !== null || pending}
          className="inline-flex items-center gap-2 rounded-md bg-danger px-4 py-2 font-medium text-white disabled:opacity-60"
          data-testid="unlock"
        >
          <LockOpen className="size-4" aria-hidden /> Mở khóa sau chốt
        </button>
      </div>
      {fields && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--overlay)] p-4" role="dialog" aria-modal="true" aria-labelledby="unlock-title">
          <div className="w-full max-w-md rounded-lg border-t-4 border-danger bg-surface p-6 shadow-pop">
            <h2 id="unlock-title" className="mb-2 text-lg font-semibold">
              Mở khóa hồ sơ {code}?
            </h2>
            <p className="mb-3 text-sm text-text-2">
              Hồ sơ về Sẵn sàng chốt; kết quả chốt hiện hành được giữ và đánh dấu bị thay thế. Không phiếu nào bị sửa: Chủ tịch hoặc Thư ký Trả phiếu cho người
              cần chấm lại rồi chốt lại trong Phiên họp mới.
            </p>
            <label className={label}>
              Gõ mã hồ sơ để xác nhận
              <input value={typed} onChange={(e) => setTyped(e.target.value)} className={input} autoFocus />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => (setFields(null), setTyped(""))} className="rounded-md border border-line-strong px-4 py-2">
                Hủy
              </button>
              <button
                type="button"
                disabled={pending || typed.trim().toUpperCase() !== code}
                onClick={unlock}
                className="rounded-md bg-danger px-4 py-2 font-medium text-white disabled:opacity-60"
              >
                {pending ? "Đang mở khóa…" : "Mở khóa"}
              </button>
            </div>
          </div>
        </div>
      )}
      {dialog}
    </form>
  );
}
