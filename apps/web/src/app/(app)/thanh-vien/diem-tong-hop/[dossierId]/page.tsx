import Link from "next/link";
import { notFound } from "next/navigation";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { AggregateTable } from "@/components/scoring/aggregate-table";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * S63 Điểm tổng hợp sau khi đủ phiếu (L15 TV-08; story 93): the S43 comparison table, read only, for a thành viên chấm
 * whose read model is `full`. Otherwise it shows no value at all, only why.
 */
export default async function MemberAggregatePage({ params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  const [dossier, scores] = await Promise.all([
    app().core.dossiers.get(actor, { dossierId }).catch(orNotFound),
    app().core.scoring.readDossierScores(actor, { dossierId }).catch(orNotFound),
  ]);
  if (!dossier || !scores || (scores.kind !== "full" && scores.kind !== "own_sheet")) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/thanh-vien/diem-tong-hop" className="text-sm text-brand">
          ← Điểm tổng hợp
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-xl font-semibold">
          {dossier.productName || "Hồ sơ chưa đặt tên sản phẩm"} <DossierStateTag state={dossier.state} />
        </h1>
        <p className="text-sm text-text-2">
          Mã hồ sơ <b className="font-mono">{dossier.code}</b> · Bộ tiêu chí {dossier.criteriaSet.code && `${dossier.criteriaSet.code} · `}
          {dossier.criteriaSet.name}
          {dossier.round && ` · ${dossier.round.name}`}
        </p>
      </div>
      {scores.kind === "full" ? (
        <AggregateTable view={scores} />
      ) : (
        <p role="status" className="rounded-lg border px-4 py-3 text-sm text-text-2" data-testid="not-ready">
          Điểm của các thành viên khác sẽ hiển thị khi anh/chị đã xác nhận phiếu và hồ sơ đủ phiếu xác nhận.{" "}
          <Link href={`/thanh-vien/ho-so/${dossierId}`} className="text-brand">
            Mở Phiếu chấm của tôi
          </Link>
        </p>
      )}
    </div>
  );
}
