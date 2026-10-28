"use client";

import { FileDown, Stamp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatPoints } from "@/components/scoring/aggregate-table";
import { sendToStorage } from "@/lib/direct-upload";
import { requestDecisionUploadAction } from "../../phien-hop/[meetingId]/actions";
import { recordSupplementaryDecisionAction } from "./actions";

export interface WaitingDossier {
  dossierId: string;
  code: string;
  productName: string;
  entityName: string;
  star: number;
  total: number;
}

/**
 * L17 (#88, spec #79 stories 56, 57): pick the hồ sơ chờ, tải dự thảo (mục 4 sao only), then ghi nhận the signed
 * Quyết định công nhận bổ sung: each becomes Công nhận 3/4 sao with Hạng công nhận 4. Nothing undoes it.
 */
export function SupplementaryDecisionForm({ dossiers }: { dossiers: WaitingDossier[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(dossiers.map((d) => d.dossierId));
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const draftHref = `/so/ho-so-5-sao/quyet-dinh-bo-sung/du-thao?${picked.map((id) => `id=${encodeURIComponent(id)}`).join("&")}`;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const file = form.get("file");
    if (picked.length === 0) return setError("Chọn ít nhất một hồ sơ");
    if (!(file instanceof File) || file.size === 0) return setError("Chọn tệp PDF quyết định đã ký");
    if (
      !window.confirm(`Ghi nhận quyết định sẽ công nhận 4 sao cho ${picked.length} hồ sơ và cấp giấy chứng nhận. Không hủy được sau khi ghi nhận. Tiếp tục?`)
    ) {
      return;
    }
    setError(undefined);
    setProgress(0);
    try {
      const req = await requestDecisionUploadAction({ fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size });
      if ("error" in req) throw new Error(req.error);
      const parts = await sendToStorage(file, req.upload, setProgress);
      const r = await recordSupplementaryDecisionAction({
        dossierIds: picked,
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
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4 text-sm" aria-label="Ghi nhận Quyết định công nhận bổ sung">
      <fieldset className="overflow-x-auto rounded-lg border">
        <legend className="sr-only">Hồ sơ đưa vào quyết định</legend>
        <table className="w-full text-left">
          <thead className="border-b bg-surface-2">
            <tr>
              <th className="px-3 py-2">Chọn</th>
              <th className="px-3 py-2">Mã hồ sơ</th>
              <th className="px-3 py-2">Sản phẩm, Chủ thể</th>
              <th className="px-3 py-2">Kết quả chốt</th>
              <th className="px-3 py-2">Hạng công nhận</th>
            </tr>
          </thead>
          <tbody>
            {dossiers.map((d) => (
              <tr key={d.dossierId} className="border-b last:border-0" data-testid="supplementary-candidate">
                <td className="px-3 py-2">
                  <input type="checkbox" aria-label={`Chọn ${d.code}`} checked={picked.includes(d.dossierId)} onChange={() => toggle(d.dossierId)} />
                </td>
                <td className="px-3 py-2 font-mono whitespace-nowrap">{d.code}</td>
                <td className="px-3 py-2">
                  <div>{d.productName || "(Chưa đặt tên sản phẩm)"}</div>
                  <div className="text-text-3">{d.entityName}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {d.star} sao · {formatPoints(d.total)} điểm
                </td>
                <td className="px-3 py-2 font-semibold">4 sao</td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>
      {picked.length > 0 ? (
        <a href={draftHref} className="inline-flex w-fit items-center gap-2 rounded-lg border px-3 py-1.5" download>
          <FileDown className="size-4" aria-hidden /> Tải dự thảo quyết định ({picked.length} hồ sơ)
        </a>
      ) : (
        <span className="text-text-3">Chọn hồ sơ để tải dự thảo.</span>
      )}
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Số quyết định</span>
          <input name="number" required maxLength={100} placeholder="456/QĐ-UBND" className="rounded-md border border-line-strong px-2 py-1.5" />
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
        disabled={progress !== null || picked.length === 0}
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-brand px-3 py-1.5 font-semibold text-white disabled:opacity-60"
      >
        <Stamp className="size-4" aria-hidden /> {progress !== null ? `Đang tải ${Math.round(progress * 100)}%` : "Ghi nhận quyết định bổ sung"}
      </button>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
