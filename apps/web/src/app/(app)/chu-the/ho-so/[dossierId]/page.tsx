import { can, DOSSIER_STATE_LABEL, type DossierEvent } from "@ocop/core";
import { Copy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { formatVnDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { DeleteDossierButton } from "./delete-button";
import { ProductForm } from "./product-form";
import { Workbench } from "./workbench";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "dossier.create": "Tạo hồ sơ",
  "dossier.delete": "Xóa hồ sơ",
};

function describe(e: DossierEvent) {
  const label = ACTION_LABEL[e.action] ?? e.action;
  return e.fromState && e.fromState !== e.toState ? `${label}: ${DOSSIER_STATE_LABEL[e.fromState]} → ${DOSSIER_STATE_LABEL[e.toState]}` : label;
}

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

      <section className="rounded-lg border bg-surface shadow-card">
        <h2 className="border-b p-4 font-semibold">Dòng thời gian</h2>
        <ol className="divide-y">
          {timeline.map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-2 px-4 py-2 text-sm">
              <span>{describe(e)}</span>
              <span className="text-text-3">{formatVnDateTime(e.occurredAt)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
