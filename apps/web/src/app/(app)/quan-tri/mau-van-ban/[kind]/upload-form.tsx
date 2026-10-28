"use client";

import type { DocumentTemplate } from "@ocop/core";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { sendToStorage } from "@/lib/direct-upload";
import { completeTemplateUploadAction, requestTemplateUploadAction, uploadTemplateAction } from "./actions";

const SCAN_WAIT_MS = 1500;
const SCAN_TRIES = 40;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Stories 73 to 75: uploads the edited Word file, waits for the scan, then records it as the next phiên bản. The
 * server checks its variables and names any that are unknown or missing. Unticking "Dùng ngay" keeps the mẫu đang dùng
 * so the new phiên bản can be tried with Sinh thử first (story 77).
 */
export function TemplateUploadForm({ kind }: { kind: DocumentTemplate }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  async function submit(form: FormData) {
    setError(undefined);
    setDone(undefined);
    const file = form.get("file");
    const activate = form.get("activate") === "on";
    if (!(file instanceof File) || file.size === 0) return setError("Chọn tệp Word (.docx) đã hiệu chỉnh");
    try {
      setBusy("Đang tải lên…");
      const req = await requestTemplateUploadAction({ fileName: file.name, size: file.size });
      if ("error" in req) throw new Error(req.error);
      const parts = await sendToStorage(file, req.upload, () => {});
      const completed = await completeTemplateUploadAction(req.fileId, parts);
      if (completed.error) throw new Error(completed.error);
      setBusy("Đang quét mã độc và kiểm tra biến…");
      for (let i = 0; i < SCAN_TRIES; i++) {
        const outcome = await uploadTemplateAction({ kind, fileId: req.fileId, activate });
        if ("n" in outcome) {
          setDone(`Đã lưu phiên bản ${outcome.n}${activate ? ", là mẫu đang dùng" : ""}.`);
          formRef.current?.reset();
          router.refresh();
          return;
        }
        if (outcome.code !== "file_not_ready") throw new Error(outcome.error);
        await sleep(SCAN_WAIT_MS);
      }
      throw new Error("Tệp chưa quét xong, hãy thử lại sau ít phút");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải lên được tệp");
    } finally {
      setBusy(null);
    }
  }

  return (
    <form ref={formRef} action={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Tệp mẫu đã hiệu chỉnh
        <input name="file" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required className="text-sm" />
        <span className="text-xs font-normal text-text-3">Word (.docx); tệp được quét mã độc và kiểm biến trước khi lưu</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="activate" type="checkbox" defaultChecked /> Dùng ngay làm mẫu đang dùng
      </label>
      {busy && (
        <p role="status" className="text-sm text-text-2">
          {busy}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-sm text-brand">
          {done}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-ink disabled:opacity-60"
        >
          <Upload className="size-4" aria-hidden /> Tải lên
        </button>
      </div>
    </form>
  );
}
