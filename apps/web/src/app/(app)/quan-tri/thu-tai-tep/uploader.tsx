"use client";

import type { UploadInstructions } from "@ocop/core";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { completeUploadAction, requestUploadAction } from "./actions";

/** PUT with progress; fetch has no upload progress, XMLHttpRequest does. */
function put(url: string, body: Blob, headers: Record<string, string>, onProgress: (sent: number) => void): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status < 300 ? resolve(xhr.getResponseHeader("ETag")) : reject(new Error(`Lưu trữ trả lỗi ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Không kết nối được tới kho lưu trữ"));
    xhr.send(body);
  });
}

async function send(file: File, upload: UploadInstructions, onProgress: (ratio: number) => void) {
  if (upload.kind === "single") {
    await put(upload.url, file, upload.headers, (sent) => onProgress(sent / file.size));
    return undefined;
  }
  const parts: { partNumber: number; etag: string }[] = [];
  let done = 0;
  for (const [i, url] of upload.partUrls.entries()) {
    const chunk = file.slice(i * upload.partSize, (i + 1) * upload.partSize);
    const etag = await put(url, chunk, {}, (sent) => onProgress((done + sent) / file.size));
    if (!etag) throw new Error("Kho lưu trữ không trả ETag (kiểm tra CORS ExposeHeaders)");
    parts.push({ partNumber: i + 1, etag });
    done += chunk.size;
  }
  return parts;
}

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
      const parts = await send(file, req.upload, setProgress);
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
        <input type="file" accept={accept} className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} disabled={progress !== null} data-testid="file-input" />
      </label>
      {progress !== null && (
        <div role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full bg-brand transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {message.error && <p role="alert" className="text-sm text-danger">{message.error}</p>}
      {message.ok && <p role="status" className="text-sm text-brand">{message.ok}</p>}
    </div>
  );
}
