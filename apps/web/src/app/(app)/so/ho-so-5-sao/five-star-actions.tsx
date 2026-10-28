"use client";

import Link from "next/link";
import type { DossierState, FiveStarClosureOutcome } from "@ocop/core";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { sendToStorage } from "@/lib/direct-upload";
import { closeAction, markSentAction, requestMinistryUploadAction, returnToProvinceAction } from "./actions";

type Mode = "send" | "return" | "close" | null;

const input = "rounded-md border border-line-strong px-2 py-1.5";
const button = "inline-flex w-fit items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold";

/** Uploads the Bộ's văn bản straight to storage; returns what the server action needs to complete it. */
async function uploadMinistryFile(file: File, onProgress: (ratio: number) => void) {
  const req = await requestMinistryUploadAction({ fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size });
  if ("error" in req) throw new Error(req.error);
  const parts = await sendToStorage(file, req.upload, onProgress);
  return { fileId: req.fileId, parts };
}

/**
 * L17 SO-04 (#87, spec #79 stories 53, 54, 58, 59): the thao tác of one hồ sơ in the "Đề xuất 5 sao" list. Đã chốt điểm:
 * đánh dấu đã gửi. Đã gửi đề nghị 5 sao: chuyển về công nhận cấp tỉnh or đóng hồ sơ, each with the Bộ's văn bản; a hồ sơ
 * already chuyển về waits for its Quyết định công nhận bổ sung and has none.
 */
export function FiveStarActions({
  dossierId,
  code,
  state,
  version,
  awaiting,
}: {
  dossierId: string;
  code: string;
  state: DossierState;
  version: number;
  awaiting: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [outcome, setOutcome] = useState<FiveStarClosureOutcome>("ministry_recognized_5_star");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();

  if (state === "five_star_proposed" && awaiting) {
    return (
      <Link href="/so/ho-so-5-sao/quyet-dinh-bo-sung" className="text-sm text-brand">
        Ghi nhận Quyết định công nhận bổ sung
      </Link>
    );
  }

  const run = async (e: FormEvent<HTMLFormElement>, act: (form: FormData) => Promise<{ error?: string }>, confirm?: string) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (confirm && !window.confirm(confirm)) return;
    setError(undefined);
    setProgress(0);
    try {
      const r = await act(form);
      if (r.error) throw new Error(r.error);
      setMode(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const fileOf = (form: FormData) => {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Chọn tệp PDF văn bản của Bộ");
    return file;
  };
  const busy = progress !== null;
  const submitLabel = (label: string) => (busy ? (progress > 0 ? `Đang tải ${Math.round(progress * 100)}%` : "Đang lưu…") : label);
  const fileField = (
    <label className="flex flex-col gap-1">
      <span className="font-medium">Văn bản của Bộ (PDF)</span>
      <input name="file" type="file" accept="application/pdf,.pdf" required className="text-sm" />
    </label>
  );

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap gap-2">
        {state === "score_finalized" && (
          <button type="button" onClick={() => setMode(mode === "send" ? null : "send")} className={`${button} bg-brand text-white`}>
            Đánh dấu đã gửi
          </button>
        )}
        {state === "five_star_proposed" && (
          <>
            <button type="button" onClick={() => setMode(mode === "return" ? null : "return")} className={`${button} border`}>
              Chuyển về công nhận cấp tỉnh
            </button>
            <button type="button" onClick={() => setMode(mode === "close" ? null : "close")} className={`${button} border`}>
              Đóng hồ sơ
            </button>
          </>
        )}
      </div>

      {mode === "send" && (
        <form
          aria-label={`Đánh dấu đã gửi ${code}`}
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) =>
            void run(e, (form) =>
              markSentAction(dossierId, {
                expectedVersion: version,
                dispatchNumber: String(form.get("dispatchNumber") ?? ""),
                sentOn: String(form.get("sentOn") ?? ""),
              }),
            )
          }
        >
          <label className="flex flex-col gap-1">
            <span className="font-medium">Số công văn</span>
            <input name="dispatchNumber" required maxLength={100} placeholder="45/SNNMT-PTNT" className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Ngày gửi</span>
            <input name="sentOn" type="date" required className={input} />
          </label>
          <button type="submit" disabled={busy} className={`${button} bg-brand text-white disabled:opacity-60`}>
            {submitLabel("Lưu")}
          </button>
        </form>
      )}

      {mode === "return" && (
        <form
          aria-label={`Chuyển về công nhận cấp tỉnh ${code}`}
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) =>
            void run(
              e,
              async (form) => returnToProvinceAction(dossierId, { expectedVersion: version, ...(await uploadMinistryFile(fileOf(form), setProgress)) }),
              `Chuyển ${code} về công nhận cấp tỉnh? Hồ sơ sẽ chờ Quyết định công nhận bổ sung (4 sao) và không đóng được nữa.`,
            )
          }
        >
          {fileField}
          <button type="submit" disabled={busy} className={`${button} bg-brand text-white disabled:opacity-60`}>
            {submitLabel("Chuyển về")}
          </button>
        </form>
      )}

      {mode === "close" && (
        <form
          aria-label={`Đóng hồ sơ ${code}`}
          className="flex flex-col gap-3"
          onSubmit={(e) =>
            void run(
              e,
              async (form) =>
                closeAction(dossierId, {
                  expectedVersion: version,
                  outcome,
                  ...(outcome === "ministry_recognized_5_star"
                    ? { decisionNumber: String(form.get("decisionNumber") ?? ""), decidedOn: String(form.get("decidedOn") ?? "") }
                    : {}),
                  ...(await uploadMinistryFile(fileOf(form), setProgress)),
                }),
              `Đóng hồ sơ ${code}? Hồ sơ chuyển "Đã đóng, xử lý ngoài hệ thống" và không mở lại được.`,
            )
          }
        >
          <fieldset className="flex flex-wrap gap-4">
            <legend className="mb-1 font-medium">Kết quả của Bộ</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="outcome" checked={outcome === "ministry_recognized_5_star"} onChange={() => setOutcome("ministry_recognized_5_star")} />
              Bộ công nhận 5 sao
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="outcome" checked={outcome === "other"} onChange={() => setOutcome("other")} />
              Kết quả khác
            </label>
          </fieldset>
          {outcome === "ministry_recognized_5_star" && (
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-medium">Số quyết định của Bộ</span>
                <input name="decisionNumber" required maxLength={100} className={input} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-medium">Ngày quyết định</span>
                <input name="decidedOn" type="date" required className={input} />
              </label>
            </div>
          )}
          {fileField}
          <button type="submit" disabled={busy} className={`${button} bg-brand text-white disabled:opacity-60`}>
            {submitLabel("Đóng hồ sơ")}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
