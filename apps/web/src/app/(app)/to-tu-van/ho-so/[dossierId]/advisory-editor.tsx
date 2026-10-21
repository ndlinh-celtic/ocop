"use client";

import { EVIDENCE_ASSESSMENT_LABEL, EVIDENCE_ASSESSMENTS, type AdvisoryCriterionView, type EvidenceAssessment } from "@ocop/core";
import { Save, Send, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { sendToStorage } from "@/lib/direct-upload";
import { completeAdvisoryAttachmentAction, reissueAdvisoryReportAction, requestAdvisoryAttachmentUploadAction, saveAdvisoryDraftAction, type AdvisoryContentInput } from "./actions";

type Line = AdvisoryContentInput["lines"][number];

export interface EditorProps {
  dossierId: string;
  criteria: AdvisoryCriterionView[];
  summary: string;
  notes: string;
  attachments: { fileId: string; fileName: string; status: string }[];
  /** `draft`: lưu nháp at `draftVersion`. `reissue`: phát hành phiên bản N+1 at `dossierVersion`, with a reason. */
  mode: { kind: "draft"; draftVersion: number } | { kind: "reissue"; dossierVersion: number; nextNumber: number };
}

/**
 * S51 biểu mẫu thẩm định (L10 TM-02, TM-05, TM-06; #56 stories 44 to 50): per Tiêu chí, nhóm theo Phần, the đánh
 * giá minh chứng, Điểm đề xuất, căn cứ and the minh chứng it cites; nhận xét tổng hợp, điểm cần lưu ý and tệp đính
 * kèm thực địa; with the sums by Phần kept live. The same form, prefilled from phiên bản N, issues N+1 (story 60).
 */
export function AdvisoryEditor({ dossierId, criteria, summary: initialSummary, notes: initialNotes, attachments: initialAttachments, mode }: EditorProps) {
  const router = useRouter();
  const [lines, setLines] = useState<Record<string, Line>>(() =>
    Object.fromEntries(
      criteria.map((c) => [
        c.criterionId,
        { criterionId: c.criterionId, levelId: c.line.levelId, basis: c.line.basis, evidenceFileIds: c.line.evidenceFileIds, evidenceAssessment: c.line.evidenceAssessment },
      ]),
    ),
  );
  const [summary, setSummary] = useState(initialSummary);
  const [notes, setNotes] = useState(initialNotes);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error?: string; ok?: string }>({});
  const [progress, setProgress] = useState<number | null>(null);

  const update = (id: string, patch: Partial<Line>) => setLines((all) => ({ ...all, [id]: { ...all[id]!, ...patch } }));
  const pointsOf = (c: AdvisoryCriterionView) => c.levels.find((l) => l.id === lines[c.criterionId]?.levelId)?.points ?? 0;
  const sums = new Map<string, number>();
  for (const c of criteria) sums.set(c.partCode, (sums.get(c.partCode) ?? 0) + pointsOf(c));
  const parts = [...sums.entries()];
  const total = parts.reduce((s, [, v]) => s + v, 0);
  const missing = criteria.filter((c) => !lines[c.criterionId]?.levelId || !lines[c.criterionId]?.basis.trim()).map((c) => c.code);

  const payload = (): AdvisoryContentInput => ({ lines: Object.values(lines), summary, notes, attachmentFileIds: attachments.map((a) => a.fileId) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage({});
    const r =
      mode.kind === "draft" ? await saveAdvisoryDraftAction(dossierId, mode.draftVersion, payload()) : await reissueAdvisoryReportAction(dossierId, mode.dossierVersion, reason, payload());
    setBusy(false);
    if (r.error) return setMessage({ error: r.error });
    setMessage({ ok: mode.kind === "draft" ? "Đã lưu nháp." : `Đã phát hành phiên bản ${mode.nextNumber}.` });
    router.refresh();
  };

  const upload = async (file: File) => {
    setProgress(0);
    setMessage({});
    try {
      const req = await requestAdvisoryAttachmentUploadAction({ fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size });
      if ("error" in req) throw new Error(req.error);
      const sent = await sendToStorage(file, req.upload, setProgress);
      const done = await completeAdvisoryAttachmentAction({ fileId: req.fileId, parts: sent });
      if (done.error) throw new Error(done.error);
      setAttachments((all) => [...all, { fileId: req.fileId, fileName: file.name, status: "scanning" }]);
      setMessage({ ok: "Đã tải tệp lên; bấm Lưu nháp để đưa vào báo cáo." });
    } catch (err) {
      setMessage({ error: (err as Error).message });
    } finally {
      setProgress(null);
    }
  };

  const byPart = [...new Set(criteria.map((c) => c.partCode))];
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" data-testid="advisory-editor">
      {byPart.map((part) => (
        <section key={part} className="rounded-lg border bg-surface shadow-card">
          <h2 className="border-b p-4 font-semibold">Phần {part}</h2>
          <ul className="flex flex-col divide-y">
            {criteria
              .filter((c) => c.partCode === part)
              .map((c) => {
                const line = lines[c.criterionId]!;
                return (
                  <li key={c.criterionId} className="flex flex-col gap-2 p-4 text-sm" data-testid="advisory-line">
                    <p>
                      <b>{c.code}</b> {c.name} <span className="text-text-3">(tối đa {c.maxPoints} điểm; Chủ thể tự chấm {c.submitted.points ?? "—"})</span>
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-text-2">Điểm đề xuất</span>
                        <select
                          className="rounded-md border bg-surface px-2 py-1.5"
                          value={line.levelId ?? ""}
                          onChange={(e) => update(c.criterionId, { levelId: e.target.value || null })}
                          aria-label={`Điểm đề xuất ${c.code}`}
                        >
                          <option value="">Chưa chọn</option>
                          {c.levels.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.points} điểm · {l.description}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-text-2">Đánh giá minh chứng</span>
                        <select
                          className="rounded-md border bg-surface px-2 py-1.5"
                          value={line.evidenceAssessment ?? ""}
                          onChange={(e) => update(c.criterionId, { evidenceAssessment: (e.target.value || null) as EvidenceAssessment | null })}
                        >
                          <option value="">Chưa đánh giá</option>
                          {EVIDENCE_ASSESSMENTS.map((a) => (
                            <option key={a} value={a}>
                              {EVIDENCE_ASSESSMENT_LABEL[a]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className="text-text-2">Căn cứ (bắt buộc khi phát hành)</span>
                      <textarea
                        className="min-h-16 rounded-md border bg-surface px-2 py-1.5"
                        value={line.basis}
                        onChange={(e) => update(c.criterionId, { basis: e.target.value })}
                        aria-label={`Căn cứ ${c.code}`}
                      />
                    </label>
                    {c.submitted.evidence.length > 0 ? (
                      <fieldset className="flex flex-wrap gap-3">
                        <legend className="text-text-2">Viện dẫn minh chứng</legend>
                        {c.submitted.evidence.map((ev) => (
                          <label key={ev.fileId} className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={line.evidenceFileIds.includes(ev.fileId)}
                              onChange={(e) =>
                                update(c.criterionId, {
                                  evidenceFileIds: e.target.checked ? [...line.evidenceFileIds, ev.fileId] : line.evidenceFileIds.filter((id) => id !== ev.fileId),
                                })
                              }
                            />
                            {ev.fileName}
                          </label>
                        ))}
                      </fieldset>
                    ) : (
                      <p className="text-amber">Chủ thể không gắn minh chứng cho tiêu chí này.</p>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      <section className="flex flex-col gap-3 rounded-lg border bg-surface p-4 text-sm shadow-card">
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Nhận xét tổng hợp</span>
          <textarea className="min-h-24 rounded-md border bg-surface px-2 py-1.5" value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Điểm cần hội đồng lưu ý</span>
          <textarea className="min-h-20 rounded-md border bg-surface px-2 py-1.5" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Tệp đính kèm thực địa (biên bản, ảnh)</span>
          {attachments.length === 0 && <p className="text-text-3">Chưa có tệp.</p>}
          {attachments.map((a) => (
            <p key={a.fileId} className="flex flex-wrap items-center gap-2">
              {a.fileName}
              {a.status === "scanning" && <span className="text-amber">Đang quét virus</span>}
              {a.status === "blocked" && <span className="text-danger">Bị chặn</span>}
              <button type="button" className="text-xs text-danger" onClick={() => setAttachments((all) => all.filter((x) => x.fileId !== a.fileId))}>
                Bỏ
              </button>
            </p>
          ))}
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 font-semibold">
            <Upload className="size-4" aria-hidden /> {progress !== null ? `Đang tải ${Math.round(progress * 100)}%` : "Tải tệp lên"}
            <input
              type="file"
              className="sr-only"
              disabled={progress !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void upload(file);
              }}
            />
          </label>
        </div>
        {mode.kind === "reissue" && (
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Lý do phát hành phiên bản {mode.nextNumber} (bắt buộc)</span>
            <textarea required className="min-h-16 rounded-md border bg-surface px-2 py-1.5" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        )}
      </section>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-lg border bg-surface p-3 text-sm shadow-card">
        <span data-testid="advisory-sums">
          {parts.map(([code, sum]) => `Phần ${code}: ${sum}`).join(" · ")} · <b>Tổng {total}</b>
        </span>
        {missing.length > 0 && <span className="text-amber">Còn thiếu Điểm đề xuất hoặc căn cứ: {missing.join(", ")}</span>}
        <button type="submit" disabled={busy} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink disabled:opacity-60">
          {mode.kind === "draft" ? <Save className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
          {mode.kind === "draft" ? "Lưu nháp" : `Phát hành phiên bản ${mode.nextNumber}`}
        </button>
        {message.error && (
          <p role="alert" className="w-full text-danger">
            {message.error}
          </p>
        )}
        {message.ok && (
          <p role="status" className="w-full text-brand">
            {message.ok}
          </p>
        )}
      </div>
    </form>
  );
}
