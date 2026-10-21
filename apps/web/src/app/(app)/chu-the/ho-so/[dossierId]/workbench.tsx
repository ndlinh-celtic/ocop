"use client";

import { DEFAULT_ALLOWED_TYPES, type SelfAssessment } from "@ocop/core";
import { Info, Link2, Paperclip, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RefreshWhileScanning } from "@/components/refresh-while-scanning";
import { sendToStorage } from "@/lib/direct-upload";
import {
  addEvidenceAction,
  explainCriterionAction,
  linkEvidenceAction,
  removeEvidenceAction,
  requestEvidenceUploadAction,
  selfScoreAction,
  type SaveResult,
} from "../actions";
import { useDossierVersion } from "./dossier-version";

const accept = Object.entries(DEFAULT_ALLOWED_TYPES)
  .flatMap(([mime, exts]) => [mime, ...exts.map((e) => `.${e}`)])
  .join(",");

const FILE_STATUS: Record<string, { label: string; style: string }> = {
  awaiting_upload: { label: "Chưa tải xong", style: "bg-surface-2 text-text-3" },
  scanning: { label: "Đang quét virus", style: "bg-amber-soft text-amber" },
  clean: { label: "Đã quét sạch", style: "bg-brand-soft text-brand" },
  blocked: { label: "Bị chặn", style: "bg-amber-soft text-danger" },
};

const stars = (n: number) => "★".repeat(n);

/**
 * L02 CT-05, CT-06 (stories 20 to 25): kho minh chứng, gắn minh chứng theo tiêu chí, giải trình and tự chấm
 * thử of one hồ sơ. Every write carries the version the page last saw; the page then reloads its data, and
 * a write refused because the hồ sơ changed meanwhile asks the Chủ thể to reload rather than overwrite.
 */
export function Workbench({ assessment, editable, onBehalf }: { assessment: SelfAssessment; editable: boolean; /** Nhập hộ (L01). */ onBehalf?: string }) {
  const router = useRouter();
  const { dossierId } = assessment;
  const version = useDossierVersion();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; conflict: boolean }>();

  async function run(write: (expectedVersion: number) => Promise<SaveResult>) {
    setPending(true);
    setError(undefined);
    try {
      const res = await write(version.current);
      if ("version" in res) {
        version.current = res.version;
        router.refresh();
        return true;
      }
      setError({ message: res.error, conflict: res.conflict });
      return false;
    } finally {
      setPending(false);
    }
  }

  const disabled = !editable || pending || !!error?.conflict;
  const criteriaById = new Map(assessment.criteria.map((c) => [c.criterionId, c]));

  return (
    <>
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

      <section className="rounded-lg border bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <h2 className="font-semibold">Kho minh chứng</h2>
          {editable && <EvidenceUploader disabled={disabled} upload={(add) => run(add)} dossierId={dossierId} onBehalf={onBehalf} />}
        </div>
        <RefreshWhileScanning active={assessment.files.some((f) => f.status === "scanning")} />
        {assessment.files.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-text-3">Chưa có tệp minh chứng.</p>
        ) : (
          <ul className="divide-y">
            {assessment.files.map((file) => (
              <li key={file.fileId} className="flex flex-col gap-2 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Paperclip className="size-4 text-text-3" aria-hidden />
                    {file.fileName}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${FILE_STATUS[file.status]?.style ?? ""}`}>{FILE_STATUS[file.status]?.label ?? file.status}</span>
                  </span>
                  {editable && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (window.confirm(`Gỡ "${file.fileName}" khỏi hồ sơ? Tệp cũng được gỡ khỏi mọi tiêu chí đã gắn.`))
                          void run((v) => removeEvidenceAction({ dossierId, onBehalf, expectedVersion: v, fileId: file.fileId }));
                      }}
                      className="flex items-center gap-1 text-danger disabled:opacity-60"
                    >
                      <Trash2 className="size-4" aria-hidden /> Gỡ khỏi hồ sơ
                    </button>
                  )}
                </div>
                <p className="text-text-2">
                  {file.criterionIds.length === 0
                    ? "Chưa gắn tiêu chí nào."
                    : `Gắn với tiêu chí ${file.criterionIds.map((id) => criteriaById.get(id)?.code ?? "?").join(", ")}`}
                </p>
                {editable && file.status === "clean" && (
                  <details>
                    <summary className="flex cursor-pointer items-center gap-1 font-medium text-brand">
                      <Link2 className="size-4" aria-hidden /> Gắn với tiêu chí
                    </summary>
                    <form
                      className="mt-2 flex flex-col gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const criterionIds = new FormData(e.currentTarget).getAll("criterionId").map(String);
                        void run((v) => linkEvidenceAction({ dossierId, onBehalf, expectedVersion: v, fileId: file.fileId, criterionIds }));
                      }}
                    >
                      <div className="grid gap-1 sm:grid-cols-2">
                        {assessment.criteria.map((c) => (
                          <label key={c.criterionId} className="flex items-start gap-2">
                            <input type="checkbox" name="criterionId" value={c.criterionId} defaultChecked={file.criterionIds.includes(c.criterionId)} className="mt-1" />
                            <span>
                              {c.code} {c.name}
                            </span>
                          </label>
                        ))}
                      </div>
                      <div>
                        <button type="submit" disabled={disabled} className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-brand-ink disabled:opacity-60">
                          Lưu gắn tiêu chí
                        </button>
                      </div>
                    </form>
                  </details>
                )}
                {file.status !== "clean" && file.status !== "blocked" && <p className="text-xs text-text-3">Tệp gắn được vào tiêu chí sau khi quét virus sạch.</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-surface shadow-card">
        <h2 className="border-b p-4 font-semibold">Tự chấm thử</h2>
        <p className="mx-4 mt-4 flex items-start gap-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Điểm tự chấm chỉ để tham khảo, không phải điểm chính thức. Điểm chính thức do hội đồng đánh giá cấp tỉnh chấm.
        </p>
        <Estimate assessment={assessment} />
        {assessment.set.parts.map((part) => (
          <div key={part.id} className="border-t">
            <h3 className="bg-surface-2 px-4 py-2 text-sm font-semibold">
              Phần {part.code}. {part.name}
            </h3>
            <ul className="divide-y">
              {assessment.criteria
                .filter((c) => c.partCode === part.code)
                .map((c) => {
                  const levels = criterionLevels(assessment, c.criterionId);
                  return (
                    <li key={c.criterionId} className="flex flex-col gap-2 px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {c.code}. {c.name} <span className="font-normal text-text-3">(tối đa {c.maxPoints} điểm)</span>
                        </span>
                        {c.evidence.length === 0 ? (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-3 ring-1 ring-line-strong">Chưa có minh chứng</span>
                        ) : (
                          <span className="text-xs text-text-2">Minh chứng: {c.evidence.map((e) => e.fileName).join(", ")}</span>
                        )}
                      </div>
                      <label className="flex flex-col gap-1">
                        <span className="text-text-2">Mức điểm tự chấm</span>
                        <select
                          value={c.levelId ?? ""}
                          disabled={disabled}
                          onChange={(e) => void run((v) => selfScoreAction({ dossierId, onBehalf, expectedVersion: v, criterionId: c.criterionId, levelId: e.target.value || null }))}
                          className="rounded-lg border border-line-strong bg-surface px-3 py-2 disabled:opacity-70"
                        >
                          <option value="">Chưa chọn</option>
                          {levels.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.description} · {l.points} điểm
                              {l.minimumStar ? ` · Sao tối thiểu ${stars(l.minimumStar)}` : ""}
                              {l.branch ? ` (nhánh ${l.branch})` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Explanation
                        key={`${c.criterionId}:${c.explanation}`}
                        initial={c.explanation}
                        disabled={disabled}
                        save={(explanation) => run((v) => explainCriterionAction({ dossierId, onBehalf, expectedVersion: v, criterionId: c.criterionId, explanation }))}
                      />
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}

function criterionLevels(assessment: SelfAssessment, criterionId: string) {
  for (const part of assessment.set.parts)
    for (const section of part.sections)
      for (const item of section.items) {
        const found = item.kind === "criterion" ? (item.id === criterionId ? item : null) : item.criteria.find((c) => c.id === criterionId);
        if (found) return found.levels;
      }
  return [];
}

/** Tổng Phần A/B/C, tổng điểm, Hạng sao ước lượng and what blocks the next Hạng sao (story 23). */
function Estimate({ assessment }: { assessment: SelfAssessment }) {
  const { estimate, blocking, unscored, thresholds } = assessment;
  const next = estimate.star < 5 ? ((estimate.star + 1) as 2 | 3 | 4 | 5) : null;
  return (
    <div className="m-4 flex flex-col gap-3 rounded-lg border border-line p-4" aria-label="Ước lượng hạng sao">
      <div className="flex flex-wrap gap-4 text-sm">
        {estimate.parts.map((p) => (
          <span key={p.code}>
            Phần {p.code}: <strong>{p.total}</strong>
          </span>
        ))}
        <span>
          Tổng điểm: <strong>{estimate.total}</strong>
        </span>
        <span>
          Hạng sao ước lượng:{" "}
          <strong className="text-amber">
            {stars(estimate.star)} {estimate.star} sao
          </strong>
          {estimate.star < 3 && <span className="text-text-3"> (dưới 3 sao là không đạt)</span>}
        </span>
      </div>
      {unscored > 0 && <p className="text-sm text-text-3">Còn {unscored} tiêu chí chưa chọn mức điểm (được tính 0 điểm). Khi nộp, mọi tiêu chí phải có mức điểm.</p>}
      {next && estimate.total < thresholds[next] && (
        <p className="text-sm text-text-2">
          Cần tối thiểu {thresholds[next]} điểm để đạt {next} sao.
        </p>
      )}
      {blocking.length > 0 && (
        <div className="text-sm">
          <p className="text-text-2">Tiêu chí đang chặn hạng {next} sao (chưa đạt Sao tối thiểu):</p>
          <ul className="ml-5 list-disc">
            {blocking.map((b) => (
              <li key={`${b.criterionId}:${b.star}`}>
                {b.code}. {b.name}: cần {b.required} điểm, đang {b.actual} điểm
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Giải trình of one Tiêu chí (story 21), saved when the field loses focus. */
function Explanation({ initial, disabled, save }: { initial: string; disabled: boolean; save: (explanation: string) => Promise<boolean> }) {
  const [value, setValue] = useState(initial);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-text-2">Giải trình</span>
      <textarea
        rows={2}
        value={value}
        disabled={disabled}
        maxLength={10_000}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value.trim() !== initial && void save(value)}
        placeholder="Giải thích minh chứng cho người đánh giá"
        className="rounded-lg border border-line-strong bg-surface px-3 py-2 disabled:opacity-70"
      />
    </label>
  );
}

/** Uploads a tệp minh chứng straight to storage, then puts it into the kho (story 20); the scan runs after. */
function EvidenceUploader({
  dossierId,
  onBehalf,
  disabled,
  upload,
}: {
  dossierId: string;
  onBehalf: string | undefined;
  disabled: boolean;
  upload: (add: (v: number) => Promise<SaveResult>) => Promise<boolean>;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const file = new FormData(formEl).get("file");
    if (!(file instanceof File) || file.size === 0) return setError("Chọn tệp minh chứng");
    setError(undefined);
    setProgress(0);
    try {
      const req = await requestEvidenceUploadAction({ fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size, onBehalf });
      if ("error" in req) throw new Error(req.error);
      const parts = await sendToStorage(file, req.upload, setProgress);
      if (await upload((v) => addEvidenceAction({ dossierId, onBehalf, expectedVersion: v, fileId: req.fileId, parts }))) formEl.reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-wrap items-center gap-2 text-sm">
      <input name="file" type="file" accept={accept} required className="max-w-60 text-sm" aria-label="Tệp minh chứng" />
      <button type="submit" disabled={disabled || progress !== null} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 font-semibold text-brand-ink disabled:opacity-60">
        <Upload className="size-4" aria-hidden /> Tải lên
      </button>
      {progress !== null && <span className="text-text-3">{Math.round(progress * 100)}%</span>}
      {error && (
        <span role="alert" className="w-full text-danger">
          {error}
        </span>
      )}
    </form>
  );
}
