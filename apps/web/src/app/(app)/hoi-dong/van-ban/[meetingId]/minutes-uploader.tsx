"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { sendToStorage } from "@/lib/direct-upload";
import { attachMinutesAction, requestMinutesUploadAction } from "./minutes-actions";

/** Story 115: uploads the biên bản đã ký số straight to storage, then adds it to the Phiên họp as the next number. */
export function MinutesUploader({ meetingId, count }: { meetingId: string; count: number }) {
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
      const req = await requestMinutesUploadAction({ fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size });
      if ("error" in req) throw new Error(req.error);
      const parts = await sendToStorage(file, req.upload, setProgress);
      const r = await attachMinutesAction(meetingId, { fileId: req.fileId, parts });
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
        <span className="font-medium">{count > 0 ? "Tải lên bản đã ký mới" : "Tải lên bản đã ký"} (PDF, ký số ngoài hệ thống)</span>
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
