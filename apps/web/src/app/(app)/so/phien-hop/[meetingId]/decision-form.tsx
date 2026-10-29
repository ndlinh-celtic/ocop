"use client";

import { Stamp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { sendToStorage } from "@/lib/direct-upload";
import { recordDecisionAction, requestDecisionUploadAction } from "./actions";

/**
 * L16 HD-11 (#83, story 9): the signed Quyết định công nhận with its số and ngày ký. The PDF goes straight to storage,
 * then the quyết định is recorded; nothing undoes it, so the Cán bộ Sở confirms first.
 */
export function DecisionForm({ meetingId, recognized, proposed }: { meetingId: string; recognized: number; proposed: number }) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return setError("Chọn tệp PDF quyết định đã ký");
    const message =
      `Ghi nhận quyết định sẽ công nhận ${recognized} hồ sơ` +
      (proposed > 0 ? `, đưa ${proposed} hồ sơ vào danh sách đề xuất 5 sao` : "") +
      " và công bố kết quả cho Chủ thể. Không hủy được sau khi ghi nhận. Tiếp tục?";
    if (!window.confirm(message)) return;
    setError(undefined);
    setProgress(0);
    try {
      const req = await requestDecisionUploadAction({ fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size });
      if ("error" in req) throw new Error(req.error);
      const parts = await sendToStorage(file, req.upload, setProgress);
      const r = await recordDecisionAction(meetingId, {
        fileId: req.fileId,
        parts,
        number: String(form.get("number") ?? ""),
        signedOn: String(form.get("signedOn") ?? ""),
      });
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
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3 text-sm" aria-label="Ghi nhận Quyết định công nhận">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Số quyết định</span>
          <input name="number" required maxLength={100} placeholder="123/QĐ-UBND" className="rounded-md border border-line-strong px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Ngày ký</span>
          <input name="signedOn" type="date" required className="rounded-md border border-line-strong px-2 py-1.5" />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Bản quyết định đã ký (PDF)</span>
        <input name="file" type="file" accept="application/pdf,.pdf" required className="text-sm" />
      </label>
      <button
        type="submit"
        disabled={progress !== null}
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-brand px-3 py-1.5 font-semibold text-white disabled:opacity-60"
      >
        <Stamp className="size-4" aria-hidden /> {progress !== null ? `Đang tải ${Math.round(progress * 100)}%` : "Ghi nhận quyết định"}
      </button>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
