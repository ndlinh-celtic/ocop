import { FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { EmptyState } from "@/components/empty-state";
import { AdvisoryReportVersion } from "@/components/scoring/advisory-report-version";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * L11 (#56 stories 62, 63): every issued phiên bản of the Báo cáo Tổ tư vấn of a hồ sơ the thành viên chấm is
 * Phân công on, newest first; never the nháp. The "Có báo cáo Tổ tư vấn mới" notice links here.
 */
export default async function MemberAdvisoryReportPage({ params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  const [dossier, versions] = await Promise.all([
    app().core.dossiers.get(actor, { dossierId }).catch(orNotFound),
    app().core.scoring.advisoryReportVersions(actor, { dossierId }).catch(orNotFound),
  ]);
  if (!dossier || !versions) notFound();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/thanh-vien/ho-so" className="text-sm text-brand">
          ← Hồ sơ được phân công
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-xl font-semibold">
          Báo cáo Tổ tư vấn · {dossier.productName || "Hồ sơ chưa đặt tên sản phẩm"} <DossierStateTag state={dossier.state} />
        </h1>
        <p className="text-sm text-text-2">
          Mã hồ sơ <b className="font-mono">{dossier.code}</b> · {dossier.entity.name}
        </p>
      </div>
      {versions.length === 0 ? (
        <EmptyState icon={FileText} title="Chưa có báo cáo Tổ tư vấn">
          Báo cáo sẽ hiện ở đây khi Tổ trưởng Tổ tư vấn phát hành.
        </EmptyState>
      ) : (
        [...versions].reverse().map((v, i) => <AdvisoryReportVersion key={v.id} dossierId={dossierId} version={v} open={i === 0} />)
      )}
    </div>
  );
}
