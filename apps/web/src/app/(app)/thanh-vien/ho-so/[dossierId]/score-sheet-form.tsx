"use client";

import { DEFAULT_ALLOWED_TYPES, rankStoredSet, type OwnSheetView, type SheetCriterion } from "@ocop/core";
import { Copy, Lock, Paperclip, PencilLine, RotateCcw, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { DownloadButton } from "@/components/download-button";
import { useReauth } from "@/components/reauth-dialog";
import { RefreshWhileScanning } from "@/components/refresh-while-scanning";
import { sendToStorage } from "@/lib/direct-upload";
import {
  completeGradingEvidenceUploadAction,
  confirmScoreSheetAction,
  downloadGradingEvidenceAction,
  requestGradingEvidenceUploadAction,
  saveScoreSheetAction,
} from "./actions";

/** What the Chủ thể put in the newest Phiên bản nộp for one Tiêu chí. */
export interface SubmittedCriterion {
  points: number;
  explanation: string;
  evidence: string[];
}

interface Line {
  levelId: string | null;
  comment: string;
  files: SheetCriterion["files"];
  /** TV-04: why the Mức điểm leaves the Tổ tư vấn's Điểm đề xuất. */
  adjustReason: string;
}

/** TV-04 (story 85): a dòng copied from the Tổ tư vấn whose Mức điểm is no longer the Mức điểm gốc. */
const adjusted = (c: SheetCriterion, line: Line) => c.advisory !== null && line.levelId !== c.advisory.levelId;

const accept = Object.entries(DEFAULT_ALLOWED_TYPES)
  .flatMap(([mime, exts]) => [mime, ...exts.map((e) => `.${e}`)])
  .join(",");
const stars = (n: number) => "★".repeat(n);

/**
 * S61 right-hand side and S62 (TV-05..07): one card per Tiêu chí, grouped by Phần, with its Mức điểm (Không đáp
 * ứng, 0 điểm included), nhận xét and bằng chứng kiểm tra; a sticky bar with Phần A/B/C, tổng and Hạng sao ước
 * lượng recomputed as the thành viên picks; Lưu nháp sends the changed dòng with the phiếu's version; Xác nhận
 * opens S62 and asks for Xác thực lại when it is due.
 */
export function ScoreSheetForm({ view, submitted, writable }: { view: OwnSheetView; submitted: Record<string, SubmittedCriterion>; writable: boolean }) {
  const router = useRouter();
  const initial = useMemo(() => new Map(view.criteria.map((c): [string, Line] => [c.criterionId, { levelId: c.levelId, comment: c.comment, files: c.files, adjustReason: c.adjustReason ?? "" }])), [view]);
  const [lines, setLines] = useState(initial);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const version = useRef(view.sheet?.version ?? 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; conflict: boolean }>();
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { run, dialog } = useReauth();
  // After a save the server's view is the truth again (file scan status included), unless edits are pending.
  useEffect(() => {
    if (dirty.size === 0) setLines(initial);
  }, [initial]);

  const edit = (criterionId: string, patch: Partial<Line>) => {
    setLines((prev) => new Map(prev).set(criterionId, { ...prev.get(criterionId)!, ...patch }));
    setDirty((prev) => new Set(prev).add(criterionId));
    setSaved(false);
  };

  const estimate = useMemo(() => {
    const scores = new Map<string, number>();
    for (const c of view.criteria) {
      const points = c.levels.find((l) => l.id === lines.get(c.criterionId)?.levelId)?.points;
      if (points !== undefined) scores.set(c.criterionId, points);
    }
    return rankStoredSet({ set: view.set, thresholds: view.thresholds, scores });
  }, [lines, view]);
  const unscored = view.criteria.filter((c) => !lines.get(c.criterionId)?.levelId).map((c) => c.code);
  const unexplained = view.criteria.filter((c) => adjusted(c, lines.get(c.criterionId)!) && !lines.get(c.criterionId)!.adjustReason.trim()).map((c) => c.code);
  // L13 TV-02 (story 84): the Tổ tư vấn's tổng over the dòng copied from it, to compare with this phiếu.
  const advisoryTotal = view.criteria.some((c) => c.advisory) ? view.criteria.reduce((n, c) => n + (c.advisory?.points ?? 0), 0) : null;

  async function save(): Promise<boolean> {
    if (dirty.size === 0) return true;
    setPending(true);
    setError(undefined);
    try {
      const res = await saveScoreSheetAction({
        dossierId: view.dossierId,
        expectedVersion: version.current,
        lines: [...dirty].map((criterionId) => {
          const l = lines.get(criterionId)!;
          const c = view.criteria.find((x) => x.criterionId === criterionId)!;
          return { criterionId, levelId: l.levelId, comment: l.comment, evidenceFileIds: l.files.map((f) => f.fileId), adjustReason: adjusted(c, l) ? l.adjustReason : null };
        }),
      });
      if ("version" in res) {
        version.current = res.version;
        setDirty(new Set());
        setSaved(true);
        router.refresh();
        return true;
      }
      setError({ message: res.error, conflict: res.conflict });
      return false;
    } finally {
      setPending(false);
    }
  }

  const confirm = () =>
    run(
      () => confirmScoreSheetAction(view.dossierId, version.current),
      (outcome) => {
        setConfirming(false);
        if (outcome.confirmed) router.refresh();
        else setError({ message: outcome.error, conflict: false });
      },
    );

  const disabled = !writable || pending || !!error?.conflict;
  const parts = [...new Set(view.criteria.map((c) => c.partCode))];

  return (
    <section className="flex flex-col gap-4" aria-label="Phiếu chấm">
      {!view.sheet && <p className="rounded-lg border px-4 py-2 text-sm text-text-2">Anh/chị chưa có Phiếu chấm cho hồ sơ này.</p>}
      {error && (
        <p role="alert" className="rounded-lg border border-danger px-4 py-2 text-sm text-danger">
          {error.message}
          {error.conflict && (
            <button type="button" onClick={() => window.location.reload()} className="ml-2 font-medium text-brand underline">
              Tải lại
            </button>
          )}
        </p>
      )}
      <RefreshWhileScanning active={view.criteria.some((c) => c.files.some((f) => f.status === "scanning"))} />

      {parts.map((part) => (
        <div key={part} className="flex flex-col gap-3">
          <h2 className="font-semibold">Phần {part}</h2>
          {view.criteria
            .filter((c) => c.partCode === part)
            .map((c) => (
              <CriterionCard
                key={c.criterionId}
                criterion={c}
                line={lines.get(c.criterionId)!}
                submitted={submitted[c.criterionId]}
                disabled={disabled}
                onChange={(patch) => edit(c.criterionId, patch)}
                onError={(message) => setError({ message, conflict: false })}
              />
            ))}
        </div>
      ))}

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-lg border bg-surface p-3 shadow-pop" data-testid="sheet-totals">
        <div className="flex flex-wrap gap-3 text-sm">
          {estimate.parts.map((p) => (
            <span key={p.code}>
              Phần {p.code}: <b>{p.total}</b>
            </span>
          ))}
          <span>
            Tổng: <b data-testid="sheet-total">{estimate.total}</b>
          </span>
          <span className="text-amber" title="Hạng sao ước lượng của phiếu này">
            {stars(estimate.star)} ước lượng
          </span>
          {advisoryTotal !== null && (
            <span className="text-text-2" data-testid="advisory-total">
              Tổ tư vấn đề xuất: <b>{advisoryTotal}</b>
            </span>
          )}
          {unscored.length > 0 && <span className="text-text-3">Chưa chấm: {unscored.join(", ")}</span>}
          {unexplained.length > 0 && <span className="text-danger">Thiếu lý do điều chỉnh: {unexplained.join(", ")}</span>}
        </div>
        {writable && (
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => void save()} disabled={disabled || dirty.size === 0} className="rounded-md border border-line-strong px-4 py-2 disabled:opacity-60">
              {pending ? "Đang lưu…" : saved && dirty.size === 0 ? "Đã lưu nháp" : "Lưu nháp"}
            </button>
            <button
              type="button"
              disabled={disabled || unscored.length > 0 || unexplained.length > 0}
              title={
                unscored.length > 0 ? "Chọn Mức điểm cho mọi Tiêu chí trước khi xác nhận" : unexplained.length > 0 ? "Ghi lý do cho mọi điều chỉnh khác Điểm đề xuất" : undefined
              }
              onClick={async () => {
                if (await save()) setConfirming(true);
              }}
              className="rounded-md bg-brand px-4 py-2 font-medium text-brand-ink disabled:opacity-60"
            >
              Xác nhận phiếu
            </button>
          </div>
        )}
      </div>

      {confirming && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--overlay)] p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-pop">
            <h2 id="confirm-title" className="mb-2 flex items-center gap-2 text-lg font-semibold">
              <Lock className="size-5" aria-hidden /> Xác nhận phiếu chấm?
            </h2>
            <p className="mb-2 text-sm">
              Tổng điểm <b>{estimate.total}</b> ({estimate.parts.map((p) => `Phần ${p.code}: ${p.total}`).join(", ")}), Hạng sao ước lượng {stars(estimate.star)}.
            </p>
            <p className="mb-4 text-sm text-text-2">
              Phiếu sẽ bị khóa. Muốn sửa phải có Trả phiếu của hội đồng. Khi đủ số phiếu đã xác nhận, Chủ tịch và Thư ký hội đồng được thông báo hồ sơ Sẵn sàng chốt. Anh/chị cần xác
              thực lại nếu đã đăng nhập quá 5 phút.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-line-strong px-4 py-2">
                Hủy
              </button>
              <button type="button" onClick={() => void confirm()} className="rounded-md bg-brand px-4 py-2 font-medium text-brand-ink">
                Xác nhận phiếu
              </button>
            </div>
          </div>
        </div>
      )}
      {dialog}
    </section>
  );
}

function CriterionCard({
  criterion: c,
  line,
  submitted,
  disabled,
  onChange,
  onError,
}: {
  criterion: SheetCriterion;
  line: Line;
  submitted: SubmittedCriterion | undefined;
  disabled: boolean;
  onChange: (patch: Partial<Line>) => void;
  onError: (message: string) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProgress(0);
    try {
      const req = await requestGradingEvidenceUploadAction({ fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size });
      if ("error" in req) throw new Error(req.error);
      const parts = await sendToStorage(file, req.upload, setProgress);
      const done = await completeGradingEvidenceUploadAction(req.fileId, parts);
      if ("error" in done) throw new Error(done.error);
      onChange({ files: [...line.files, { fileId: req.fileId, fileName: file.name, status: "scanning" }] });
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setProgress(null);
    }
  };
  return (
    <article className="rounded-lg border bg-surface p-4 shadow-card" data-testid="sheet-criterion">
      <h3 className="flex flex-wrap items-center gap-2 font-medium">
        <span>
          <span className="font-mono">{c.code}</span> {c.name} <span className="text-sm font-normal text-text-3">(tối đa {c.maxPoints} điểm)</span>
        </span>
        {c.advisory &&
          (adjusted(c, line) ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-2 py-0.5 text-xs font-normal text-amber" data-testid="badge-adjusted">
              <PencilLine className="size-3" aria-hidden /> Đã chỉnh · Tổ tư vấn: <s>{c.advisory.points} điểm</s>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-normal text-text-2" data-testid="badge-advisory">
              <Copy className="size-3" aria-hidden /> Từ Tổ tư vấn, phiên bản {c.advisory.number}
            </span>
          ))}
      </h3>
      {submitted && (
        <details className="mt-1 text-sm text-text-2">
          <summary className="cursor-pointer">
            Chủ thể tự chấm {submitted.points} điểm · {submitted.evidence.length} minh chứng
          </summary>
          {submitted.explanation && <p className="mt-1 whitespace-pre-line">{submitted.explanation}</p>}
          {submitted.evidence.length > 0 && <p className="mt-1">Minh chứng: {submitted.evidence.join(", ")}</p>}
        </details>
      )}
      <fieldset className="mt-3 flex flex-col gap-1" disabled={disabled}>
        <legend className="sr-only">Mức điểm của Tiêu chí {c.code}</legend>
        {c.levels.map((l) => (
          <label key={l.id} className="flex items-start gap-2 text-sm">
            <input type="radio" name={`level-${c.criterionId}`} checked={line.levelId === l.id} onChange={() => onChange({ levelId: l.id })} className="mt-1" />
            <span>
              <b>{l.points} điểm</b> · {l.description}
              {l.minimumStar !== null && <span className="ml-1 text-amber">(Sao tối thiểu {l.minimumStar})</span>}
            </span>
          </label>
        ))}
      </fieldset>
      {c.advisory && adjusted(c, line) && (
        <div className="mt-3 text-sm">
          <label className="block">
            <span className="text-text-2">
              Lý do điều chỉnh <span className="text-danger">*</span> (Tổ tư vấn đề xuất {c.advisory.points} điểm · {c.advisory.description})
            </span>
            <textarea
              value={line.adjustReason}
              disabled={disabled}
              required
              aria-invalid={!line.adjustReason.trim()}
              onChange={(e) => onChange({ adjustReason: e.target.value })}
              rows={2}
              maxLength={10_000}
              className={`mt-1 w-full rounded-md border px-2 py-1 ${line.adjustReason.trim() ? "" : "border-danger"}`}
            />
          </label>
          {!disabled && (
            <button type="button" onClick={() => onChange({ levelId: c.advisory!.levelId, adjustReason: "" })} className="mt-1 inline-flex items-center gap-1 text-brand">
              <RotateCcw className="size-3" aria-hidden /> Khôi phục theo Tổ tư vấn
            </button>
          )}
        </div>
      )}
      <label className="mt-3 block text-sm">
        <span className="text-text-2">Nhận xét</span>
        <textarea
          value={line.comment}
          disabled={disabled}
          onChange={(e) => onChange({ comment: e.target.value })}
          rows={2}
          maxLength={10_000}
          className="mt-1 w-full rounded-md border px-2 py-1"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {line.files.map((f) => (
          <span key={f.fileId} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5">
            <Paperclip className="size-3" aria-hidden /> {f.fileName}
            {f.status === "scanning" && <span className="text-amber">(đang quét)</span>}
            {f.status === "blocked" && <span className="text-danger">(bị chặn)</span>}
            {f.status === "clean" && <DownloadButton fileId={f.fileId} download={downloadGradingEvidenceAction} label="Tải" />}
            {!disabled && (
              <button type="button" aria-label={`Bỏ ${f.fileName}`} onClick={() => onChange({ files: line.files.filter((x) => x.fileId !== f.fileId) })}>
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <label className="inline-flex cursor-pointer items-center gap-1 text-brand">
            <Upload className="size-4" aria-hidden /> Đính kèm bằng chứng kiểm tra
            <input type="file" accept={accept} className="sr-only" onChange={(e) => void upload(e)} />
          </label>
        )}
        {progress !== null && <span className="text-text-3">{Math.round(progress * 100)}%</span>}
      </div>
    </article>
  );
}
