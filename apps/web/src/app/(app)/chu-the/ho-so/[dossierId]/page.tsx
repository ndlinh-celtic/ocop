import { can } from "@ocop/core";
import { Copy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DossierFlags } from "@/components/dossiers/dossier-flags";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { DossierTimeline } from "@/components/dossiers/dossier-timeline";
import { RejectionNotice } from "@/components/dossiers/rejection-notice";
import { SubmissionDocuments } from "@/components/dossiers/submission-documents";
import { formatVnDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { DeleteDossierButton } from "./delete-button";
import { ProductForm } from "./product-form";
import { SubmitPanel, WithdrawForm } from "./submit-panel";
import { Workbench } from "./workbench";

export const dynamic = "force-dynamic";

/**
 * S14 Trình soạn hồ sơ (L02 CT-03, CT-05, CT-06): thông tin sản phẩm, kho minh chứng gắn theo tiêu chí,
 * giải trình, tự chấm thử and dòng thời gian of one hồ sơ.
 */
export default async function DossierPage({ params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  const [dossier, timeline, assessment] = await Promise.all([
    app().core.dossiers.get(actor, { dossierId }).catch(orNotFound),
    app().core.dossiers.timeline(actor, { dossierId }).catch(orNotFound),
    app().core.dossiers.selfAssessment(actor, { dossierId }).catch(orNotFound),
  ]);
  if (!dossier || !timeline || !assessment) notFound();
  const editable = can(actor, "dossier.edit", dossier);
  const submittable = can(actor, "dossier.submit", dossier);
  const check = submittable ? await app().core.dossiers.submissionCheck(actor, { dossierId }) : null;
  const withdrawable = can(actor, "dossier.withdraw", dossier) && dossier.receivedAt === null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/chu-the/ho-so" className="text-sm text-brand">
            ← Hồ sơ của tôi
          </Link>
          <h1 className="mt-1 flex items-center gap-3 text-xl font-semibold">
            {dossier.productName || "Hồ sơ chưa đặt tên sản phẩm"} <DossierStateTag state={dossier.state} />
          </h1>
          <p className="text-sm text-text-2">
            Bộ tiêu chí {dossier.criteriaSet.code && `${dossier.criteriaSet.code} · `}
            {dossier.criteriaSet.name}, căn cứ {dossier.criteriaVersion.legalBasis}
          </p>
          {dossier.copiedFrom && (
            <p className="text-sm text-text-3">
              Sao chép từ hồ sơ{" "}
              <Link href={`/chu-the/ho-so/${dossier.copiedFrom.id}`} className="text-brand underline-offset-2 hover:underline">
                {dossier.copiedFrom.productName || "chưa đặt tên"}
              </Link>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Link href={`/chu-the/ho-so/moi?tu=${dossier.id}`} className="flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium">
            <Copy className="size-4" aria-hidden /> Sao chép sang hồ sơ mới
          </Link>
          {can(actor, "dossier.delete", dossier) && <DeleteDossierButton dossierId={dossier.id} version={dossier.version} />}
        </div>
      </div>

      {dossier.latestSubmission && (
        <section className="flex flex-col gap-2 rounded-lg border bg-surface p-4 text-sm shadow-card">
          <p>
            Phiên bản nộp {dossier.latestSubmission.number}, nộp lúc {formatVnDateTime(dossier.latestSubmission.submittedAt)}.
          </p>
          <SubmissionDocuments dossierId={dossier.id} submissionNumber={dossier.latestSubmission.number} />
          {dossier.receivedAt && <p>Xã đã tiếp nhận lúc {formatVnDateTime(dossier.receivedAt)}.</p>}
          <DossierFlags flags={dossier.flags} />
        </section>
      )}
      {dossier.rejection && <RejectionNotice rejection={dossier.rejection} />}

      <section className="rounded-lg border bg-surface p-4 shadow-card">
        <h2 className="mb-3 font-semibold">Thông tin sản phẩm</h2>
        {!editable && <p className="mb-3 text-sm text-text-3">Hồ sơ đã nộp không sửa trực tiếp được.</p>}
        <ProductForm
          dossierId={dossier.id}
          version={dossier.version}
          editable={editable}
          initial={{
            productName: dossier.productName,
            description: dossier.description,
            ingredients: dossier.ingredients,
            process: dossier.process,
            packaging: dossier.packaging,
            qualityDeclaration: dossier.qualityDeclaration,
          }}
        />
      </section>

      <Workbench assessment={assessment} editable={editable} />

      {check && <SubmitPanel dossierId={dossier.id} version={dossier.version} blockers={check.blockers} />}
      {withdrawable && <WithdrawForm dossierId={dossier.id} version={dossier.version} />}

      <DossierTimeline events={timeline} />
    </div>
  );
}
