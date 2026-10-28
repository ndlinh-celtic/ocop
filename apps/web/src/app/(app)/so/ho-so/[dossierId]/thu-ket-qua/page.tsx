import { DomainError, LETTER_REASON_LABEL, MAX_ADVICE } from "@ocop/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadButton } from "@/components/download-button";
import { formatPoints } from "@/components/scoring/aggregate-table";
import { formatVnDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { downloadLetterAction } from "./actions";
import { LetterForm } from "./letter-form";

export const dynamic = "force-dynamic";

/**
 * L16 HD-10 (#85, spec #79 stories 36 to 44): the Cán bộ Sở soạn and phát hành the Thư kết quả không đạt of a hồ sơ dưới 3
 * sao Đã chốt điểm, then any thư đính chính; each phiên bản issued stays downloadable. A hồ sơ the letter is not for
 * (from 3 sao, not yet chốt) says so.
 */
export default async function ResultLetterPage({ params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  let draft;
  try {
    draft = await app().core.results.resultLetterDraft(actor, { dossierId }).catch(orNotFound);
  } catch (err) {
    if (!(err instanceof DomainError) || err.code === "forbidden") throw err;
    return (
      <div className="flex flex-col gap-3">
        <Link href={`/so/ho-so/${dossierId}`} className="text-sm text-brand">
          ← Chi tiết hồ sơ
        </Link>
        <p role="alert" className="rounded-lg border border-amber bg-amber-soft p-3 text-sm text-amber">
          {err.message}
        </p>
      </div>
    );
  }
  if (!draft) notFound();
  const latest = draft.letters.at(-1);
  const reasonsOf = new Map(draft.suggested.map((c) => [c.criterionId, c.reasons.map((r) => LETTER_REASON_LABEL[r]).join("; ")]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/so/ho-so/${dossierId}`} className="text-sm text-brand">
          ← Chi tiết hồ sơ
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Thư kết quả không đạt</h1>
        <p className="text-sm text-text-2">
          Mã hồ sơ <b className="font-mono">{draft.code}</b> · {draft.productName}
        </p>
      </div>

      <section className="flex flex-col gap-2 rounded-lg border bg-surface p-4 text-sm shadow-card">
        <h2 className="font-semibold">Kết quả chốt điểm</h2>
        <p className="font-medium">
          {draft.star} sao (không đạt), {formatPoints(draft.total)} điểm ({draft.parts.map((p) => `Phần ${p.code} ${formatPoints(p.total)}`).join(", ")}).
        </p>
        <div>
          <p className="font-medium">Nhận xét chung của Hội đồng</p>
          <p className="whitespace-pre-line text-text-2">{draft.generalComment || "Hội đồng chưa viết nhận xét chung."}</p>
        </div>
      </section>

      {draft.letters.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border bg-surface p-4 text-sm shadow-card" data-testid="issued-letters">
          <h2 className="font-semibold">Thư đã phát hành</h2>
          <ul className="flex flex-col gap-2">
            {draft.letters.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3">
                <span>
                  {l.n === 1 ? "Thư kết quả" : `Thư đính chính lần ${l.n - 1}`} · {formatVnDateTime(l.issuedAt)} · {l.issuedBy.fullName}
                  {l.reason && <span className="text-text-2"> · Lý do: {l.reason}</span>}
                </span>
                <DownloadButton fileId={`${dossierId}:${l.id}`} download={downloadLetterAction} label="Tải PDF" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card">
        <h2 className="font-semibold">{latest ? "Phát hành thư đính chính" : "Soạn thư"}</h2>
        <LetterForm
          dossierId={dossierId}
          version={draft.dossierVersion}
          correction={latest !== undefined}
          criteria={draft.criteria.map((c) => ({
            criterionId: c.criterionId,
            label: `${c.code} ${c.name}: ${formatPoints(c.average)} / ${formatPoints(c.maxPoints)} điểm`,
            reasons: reasonsOf.get(c.criterionId) ?? "",
          }))}
          initialCriterionIds={latest ? latest.criteria.map((c) => c.criterionId) : draft.suggested.map((c) => c.criterionId)}
          initialAdvice={latest?.advice ?? ""}
          maxAdvice={MAX_ADVICE}
        />
      </section>
    </div>
  );
}
