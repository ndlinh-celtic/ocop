"use client";

import { DEFAULT_ALLOWED_TYPES } from "@ocop/core";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { sendToStorage } from "@/lib/direct-upload";
import { addLegalDocumentAction, completeLegalUploadAction, requestLegalUploadAction } from "./actions";

const input = "rounded-md border border-line-strong bg-surface px-3 py-2";
const label = "flex flex-col gap-1 text-sm font-medium";
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const accept = ACCEPTED.flatMap((mime) => [mime, ...(DEFAULT_ALLOWED_TYPES[mime] ?? []).map((e) => `.${e}`)]).join(",");

/**
 * Adds a giấy tờ pháp lý (L01 CT-02, story 5): the file goes straight to storage through the files flow,
 * then the giấy tờ is recorded with its dates. With `replaces`, it replaces a current one of that Loại.
 */
export function LegalDocumentForm({
  entityId,
  types,
  replaces,
  onDone,
}: {
  entityId: string;
  types: { code: string; name: string }[];
  replaces?: { id: string; typeCode: string };
  onDone?: () => void;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return setError("Chọn tệp giấy tờ");
    setError(undefined);
    setProgress(0);
    try {
      const req = await requestLegalUploadAction({ fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size });
      if ("error" in req) throw new Error(req.error);
      const parts = await sendToStorage(file, req.upload, setProgress);
      const done = await completeLegalUploadAction(req.fileId, parts);
      if (done.error) throw new Error(done.error);
      const validUntil = String(form.get("validUntil") ?? "");
      const added = await addLegalDocumentAction({
        entityId,
        typeCode: replaces?.typeCode ?? String(form.get("typeCode") ?? ""),
        fileId: req.fileId,
        documentNumber: String(form.get("documentNumber") ?? ""),
        issuedOn: String(form.get("issuedOn") ?? ""),
        validUntil: validUntil || null,
        replacesId: replaces?.id,
      });
      if (added.error) throw new Error(added.error);
      formEl.reset();
      onDone?.();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {!replaces && (
          <label className={`${label} sm:col-span-2`}>
            Loại giấy tờ
            <select name="typeCode" required defaultValue="" className={input}>
              <option value="" disabled>
                Chọn loại giấy tờ
              </option>
              {types.map((ty) => (
                <option key={ty.code} value={ty.code}>
                  {ty.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={label}>
          Số giấy tờ
          <input name="documentNumber" className={input} />
        </label>
        <label className={label}>
          Ngày cấp
          <input name="issuedOn" type="date" required className={input} />
        </label>
        <label className={label}>
          Hiệu lực đến
          <input name="validUntil" type="date" className={input} />
          <span className="text-xs font-normal text-text-3">Để trống nếu giấy tờ không có thời hạn</span>
        </label>
        <label className={label}>
          Tệp giấy tờ
          <input name="file" type="file" accept={accept} required className="text-sm" />
          <span className="text-xs font-normal text-text-3">PDF hoặc ảnh chụp; tệp được quét mã độc trước khi dùng</span>
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
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={progress !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60"
        >
          <Upload className="size-4" aria-hidden />
          {replaces ? "Thay giấy tờ" : "Thêm giấy tờ"}
        </button>
      </div>
    </form>
  );
}
