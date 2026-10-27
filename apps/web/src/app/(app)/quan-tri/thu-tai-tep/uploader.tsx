"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendToStorage } from "@/lib/direct-upload";
import { completeUploadAction, requestUploadAction } from "./actions";

export function Uploader({ accept }: { accept: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ error?: string; ok?: string }>({});

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage({});
    setProgress(0);
    try {
      const req = await requestUploadAction({ fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size });
      if ("error" in req) throw new Error(req.error);
      const parts = await sendToStorage(file, req.upload, setProgress);
      const done = await completeUploadAction(req.fileId, parts);
      if (done.error) throw new Error(done.error);
      setMessage({ ok: `Đã tải lên ${file.name}` });
      router.refresh();
    } catch (err) {
      setMessage({ error: (err as Error).message });
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface-2 p-8 text-center hover:border-brand">
        <Upload className="size-6 text-brand" aria-hidden />
        <span className="font-medium">Chọn tệp để tải lên</span>
        <span className="text-xs text-text-3">PDF, ảnh, Word, Excel, video MP4</span>
        <input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => void onFile(e.target.files?.[0])}
          disabled={progress !== null}
          data-testid="file-input"
        />
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
      {message.error && (
        <p role="alert" className="text-sm text-danger">
          {message.error}
        </p>
      )}
      {message.ok && (
        <p role="status" className="text-sm text-brand">
          {message.ok}
        </p>
      )}
    </div>
  );
}
