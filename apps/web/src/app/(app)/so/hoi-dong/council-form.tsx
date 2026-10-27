"use client";

import { DEFAULT_ALLOWED_TYPES } from "@ocop/core";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { sendToStorage } from "@/lib/direct-upload";
import { completeDecisionUploadAction, createCouncilAction, requestDecisionUploadAction, updateCouncilAction } from "./actions";

const input = "rounded-md border border-line-strong bg-surface px-3 py-2";
const label = "flex flex-col gap-1 text-sm font-medium";
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];
const accept = ACCEPTED.flatMap((mime) => [mime, ...(DEFAULT_ALLOWED_TYPES[mime] ?? []).map((e) => `.${e}`)]).join(",");

export interface CouncilFormValues {
  id: string;
  name: string;
  decisionNumber: string;
  decisionDate: string;
  decisionFileId: string;
  decisionFileName: string | null;
}

/**
 * S40 (L09 HD-01 stories 1, 4): records a Hội đồng from its quyết định thành lập, or corrects one. The
 * quyết định goes straight to storage through the files flow; when editing, it is optional and the
 * recorded one stays unless another is chosen.
 */
export function CouncilForm({ council }: { council?: CouncilFormValues }) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const file = form.get("file");
    const hasFile = file instanceof File && file.size > 0;
    if (!hasFile && !council) return setError("Chọn tệp quyết định thành lập");
    setError(undefined);
    setSaved(false);
    setProgress(hasFile ? 0 : null);
    try {
      let decisionFileId = council?.decisionFileId ?? "";
      if (hasFile) {
        const req = await requestDecisionUploadAction({ fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size });
        if ("error" in req) throw new Error(req.error);
        const parts = await sendToStorage(file, req.upload, setProgress);
        const done = await completeDecisionUploadAction(req.fileId, parts);
        if (done.error) throw new Error(done.error);
        decisionFileId = req.fileId;
      }
      const fields = {
        name: String(form.get("name") ?? ""),
        decisionNumber: String(form.get("decisionNumber") ?? ""),
        decisionDate: String(form.get("decisionDate") ?? ""),
        decisionFileId,
      };
      if (council) {
        const r = await updateCouncilAction(council.id, fields);
        if (r.error) throw new Error(r.error);
        setSaved(true);
        router.refresh();
      } else {
        const r = await createCouncilAction(fields);
        if (r.error || !r.councilId) throw new Error(r.error ?? "Không lưu được hội đồng");
        formEl.reset();
        router.push(`/so/hoi-dong/${r.councilId}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <label className={label}>
        Tên hội đồng
        <input name="name" required defaultValue={council?.name} placeholder="Hội đồng đánh giá, phân hạng sản phẩm OCOP tỉnh" className={input} />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={label}>
          Số quyết định thành lập
          <input name="decisionNumber" required defaultValue={council?.decisionNumber} placeholder="12/QĐ-UBND" className={input} />
        </label>
        <label className={label}>
          Ngày quyết định
          <input name="decisionDate" type="date" required defaultValue={council?.decisionDate} className={input} />
        </label>
        <label className={label}>
          Tệp quyết định
          <input name="file" type="file" accept={accept} required={!council} className="text-sm" />
          <span className="text-xs font-normal text-text-3">
            {council?.decisionFileName
              ? `Đang lưu: ${council.decisionFileName}. Chọn tệp khác để thay.`
              : "PDF hoặc ảnh chụp; tệp được quét mã độc trước khi dùng"}
          </span>
        </label>
      </div>
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
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={progress !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60"
        >
          <Upload className="size-4" aria-hidden />
          {council ? "Lưu thay đổi" : "Ghi nhận hội đồng"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm text-brand">
            Đã lưu
          </p>
        )}
      </div>
    </form>
  );
}
