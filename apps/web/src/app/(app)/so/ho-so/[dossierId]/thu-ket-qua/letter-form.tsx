"use client";

import { Eye, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { issueResultLetterAction, type LetterActionInput } from "./actions";

interface CriterionOption {
  criterionId: string;
  label: string;
  /** "Sao tối thiểu chưa đạt; Điểm trung bình dưới tỷ lệ", empty when not computed dưới mức. */
  reasons: string;
}

/**
 * L16 HD-10 (#85, stories 36 to 43): the Sở's form for the Thư kết quả không đạt. The Tiêu chí dưới mức start ticked, the
 * Sở may untick them or tick others of the same Bộ tiêu chí, writes the lời khuyên, previews the Word file, then phát
 * hành. After the first letter the same form issues a thư đính chính, which needs a lý do.
 */
export function LetterForm(props: {
  dossierId: string;
  version: number;
  correction: boolean;
  criteria: CriterionOption[];
  initialCriterionIds: string[];
  initialAdvice: string;
  maxAdvice: number;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState(new Set(props.initialCriterionIds));
  const [advice, setAdvice] = useState(props.initialAdvice);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"preview" | "issue" | null>(null);
  const [error, setError] = useState<string>();

  const input = (): LetterActionInput => ({
    dossierId: props.dossierId,
    expectedVersion: props.version,
    criterionIds: props.criteria.filter((c) => chosen.has(c.criterionId)).map((c) => c.criterionId),
    advice,
    ...(props.correction ? { reason } : {}),
  });

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const preview = async () => {
    setError(undefined);
    setBusy("preview");
    try {
      const { dossierId: _d, ...body } = input();
      const res = await fetch(`/so/ho-so/${props.dossierId}/thu-ket-qua/xem-truoc`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "Thu ket qua (xem truoc).docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const issue = async () => {
    const message = props.correction
      ? "Phát hành thư đính chính? Chủ thể sẽ nhận email và chỉ thấy thư mới nhất."
      : "Phát hành thư? Hồ sơ chuyển sang Không đạt, kết quả được công bố và Chủ thể nhận email. Không hủy được.";
    if (!window.confirm(message)) return;
    setError(undefined);
    setBusy("issue");
    const r = await issueResultLetterAction(input());
    setBusy(null);
    if (r.error) return setError(r.conflict ? `${r.error}. Tải lại trang để lấy dữ liệu mới nhất.` : r.error);
    setReason("");
    router.refresh();
  };

  return (
    <form className="flex flex-col gap-4 text-sm" aria-label="Soạn Thư kết quả không đạt" onSubmit={(e) => e.preventDefault()}>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-medium">Tiêu chí cần cải thiện</legend>
        {props.criteria.map((c) => (
          <label key={c.criterionId} className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={chosen.has(c.criterionId)} onChange={() => toggle(c.criterionId)} />
            <span>
              {c.label}
              {c.reasons && <span className="text-amber"> ({c.reasons})</span>}
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Lời khuyên cải thiện</span>
        <textarea
          value={advice}
          onChange={(e) => setAdvice(e.target.value)}
          maxLength={props.maxAdvice}
          rows={5}
          className="rounded-md border border-line-strong px-2 py-1.5"
        />
      </label>
      {props.correction && (
        <label className="flex flex-col gap-1">
          <span className="font-medium">Lý do đính chính</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} required className="rounded-md border border-line-strong px-2 py-1.5" />
        </label>
      )}
      <p className="text-text-3">Thư luôn có câu hướng dẫn Chủ thể hoàn thiện sản phẩm và nộp lại hồ sơ ở đợt đánh giá sau.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void preview()}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-60"
        >
          <Eye className="size-4" aria-hidden /> {busy === "preview" ? "Đang tạo…" : "Xem trước (Word)"}
        </button>
        <button
          type="button"
          onClick={() => void issue()}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 font-semibold text-white disabled:opacity-60"
        >
          <Send className="size-4" aria-hidden /> {busy === "issue" ? "Đang phát hành…" : props.correction ? "Phát hành thư đính chính" : "Phát hành thư"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
