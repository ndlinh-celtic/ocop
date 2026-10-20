import Link from "next/link";
import { notFound } from "next/navigation";
import { CriteriaSetHeading, CriteriaSetSheet } from "@/components/criteria/criteria-set-sheet";
import { orNotFound } from "@/components/criteria/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { PreviewPanel } from "./preview-panel";

export const dynamic = "force-dynamic";

/** One Bộ tiêu chí: Phần → Mục → (Nhóm tiêu chí) → Tiêu chí → Mức điểm, and its Điều kiện loại (L19). */
export default async function CriteriaSetPage({ params }: { params: Promise<{ versionId: string; setId: string }> }) {
  const { versionId, setId } = await params;
  const actor = await requireActor();
  const view = await app().core.criteria.getCriteriaSet(actor, { setId }).catch(orNotFound);
  if (!view || view.version.id !== versionId) notFound();
  const { set } = view;
  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-text-3">
        <Link href="/quan-tri/bo-tieu-chi">Phiên bản tiêu chí</Link> / <Link href={`/quan-tri/bo-tieu-chi/${versionId}`}>{view.version.legalBasis}</Link> / Bộ{" "}
        {set.code}
      </nav>
      <CriteriaSetHeading view={view} />

      {view.version.status === "draft" && (
        <PreviewPanel
          setId={set.id}
          parts={set.parts.map((p) => ({
            code: p.code,
            name: p.name,
            points: p.points,
            criteria: p.sections.flatMap((sc) => sc.items.flatMap((i) => (i.kind === "group" ? i.criteria : [i]))).map((c) => ({ id: c.id, code: c.code, name: c.name, maxPoints: c.maxPoints, levels: [...c.levels] })),
          }))}
        />
      )}

      <CriteriaSetSheet set={set} />
    </div>
  );
}
