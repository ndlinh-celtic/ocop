"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { sendToStorage } from "@/lib/direct-upload";
import { requestSignedUploadAction, uploadSignedAction } from "./actions";

/** L16 HD-11 (#84, stories 28, 29): uploads the signed PDF of one giấy; a re-upload asks for its lý do. */
export function SignedUpload({ certificateId, reupload }: { certificateId: string; reupload: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return setError("Chọn tệp PDF đã ký");
    const reason = String(form.get("reason") ?? "").trim();
    if (reupload && !reason) return setError("Nhập lý do tải lại");
    setError(undefined);
    setBusy(true);
    try {
      const req = await requestSignedUploadAction({ fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size });
      if ("error" in req) throw new Error(req.error);
      const parts = await sendToStorage(file, req.upload, () => {});
      const r = await uploadSignedAction(certificateId, { fileId: req.fileId, parts, reason: reason || undefined });
      if (r.error) throw new Error(r.error);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
        <Upload className="size-3.5" aria-hidden /> {reupload ? "Tải lại bản đã ký" : "Tải lên bản đã ký"}
      </button>
    );
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2 text-xs" aria-label="Tải lên giấy chứng nhận đã ký">
      <input name="file" type="file" accept="application/pdf,.pdf" required />
      {reupload && <input name="reason" required maxLength={1000} placeholder="Lý do tải lại" className="rounded-md border border-line-strong px-2 py-1" />}
      <span className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-md bg-brand px-2 py-1 font-semibold text-white disabled:opacity-60">
          {busy ? "Đang tải..." : "Lưu"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-2 py-1">
          Hủy
        </button>
      </span>
      {error && (
        <span role="alert" className="text-danger">
          {error}
        </span>
      )}
    </form>
  );
}
