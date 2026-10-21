import Link from "next/link";
import { notFound } from "next/navigation";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { AggregateTable } from "@/components/scoring/aggregate-table";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { ReturnPanel } from "./return-panel";

export const dynamic = "force-dynamic";

/**
 * S43 Tổng hợp điểm (L15 HD-04, HD-05; stories 98 to 101), before chốt: the phiếu đã xác nhận of each thành viên
 * chấm side by side with the điểm tổng hợp, the Hạng sao and the Cờ chênh lệch. Before Sẵn sàng chốt the read model
 * gives progress only, so the page says so and shows no points.
 */
export default async function AggregatePage({ params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  const [dossier, scores] = await Promise.all([
    app().core.dossiers.get(actor, { dossierId }).catch(orNotFound),
    app().core.scoring.readDossierScores(actor, { dossierId }).catch(orNotFound),
  ]);
  if (!dossier || !scores || (scores.kind !== "full" && scores.kind !== "progress_only")) notFound();
  const history = await app().core.scoring.scoreSheetHistory(actor, { dossierId });
  const ready = (await app().core.scoring.gradingProgress(actor)).filter((r) => r.state === "member_confirmed").map((r) => r.dossierId);
  const at = ready.indexOf(dossierId);
  const prev = at > 0 ? ready[at - 1] : undefined;
  const next = at >= 0 && at < ready.length - 1 ? ready[at + 1] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/hoi-dong/chot-diem" className="text-sm text-brand">
            ← Tổng hợp điểm
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-xl font-semibold">
            {dossier.productName || "Hồ sơ chưa đặt tên sản phẩm"} <DossierStateTag state={dossier.state} />
          </h1>
          <p className="text-sm text-text-2">
            Mã hồ sơ <b className="font-mono">{dossier.code}</b> · {dossier.entity.name} · Bộ tiêu chí {dossier.criteriaSet.code && `${dossier.criteriaSet.code} · `}
            {dossier.criteriaSet.name}
            {dossier.round && ` · ${dossier.round.name}`}
          </p>
        </div>
        {at >= 0 && (
          <nav className="flex gap-2 text-sm" aria-label="Hồ sơ trước sau">
            {prev ? (
              <Link href={`/hoi-dong/chot-diem/${prev}`} className="rounded-md border px-3 py-1.5">
                ← Hồ sơ trước
              </Link>
            ) : null}
            {next ? (
              <Link href={`/hoi-dong/chot-diem/${next}`} className="rounded-md border px-3 py-1.5">
                Hồ sơ sau →
              </Link>
            ) : null}
          </nav>
        )}
      </div>

      {scores.kind === "full" ? (
        <AggregateTable view={scores} />
      ) : (
        <p role="status" className="rounded-lg border border-amber bg-amber-soft px-4 py-3 text-sm" data-testid="not-ready">
          Chưa đủ phiếu: {scores.progress.filter((p) => p.state === "confirmed").length} / {scores.minGraders} phiếu đã xác nhận. Điểm của các thành viên hiện khi hồ
          sơ Sẵn sàng chốt.
        </p>
      )}

      {(dossier.state === "member_review" || dossier.state === "member_confirmed") && (
        <ReturnPanel dossierId={dossierId} graders={scores.kind === "full" ? scores.graders : scores.progress} history={history} />
      )}
    </div>
  );
}
