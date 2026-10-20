import Link from "next/link";
import { notFound } from "next/navigation";
import { CriteriaSetHeading, CriteriaSetSheet } from "@/components/criteria/criteria-set-sheet";
import type { EditSlot } from "@/components/criteria/edit-target";
import { orNotFound } from "@/components/criteria/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { DraftControls } from "../../draft-controls";
import { ValidationIssues } from "../../validation-issues";
import { PreviewPanel } from "./preview-panel";

export const dynamic = "force-dynamic";

/** One Bộ tiêu chí: Phần → Mục → (Nhóm tiêu chí) → Tiêu chí → Mức điểm, and its Điều kiện loại (L19). */
export default async function CriteriaSetPage({ params }: { params: Promise<{ versionId: string; setId: string }> }) {
  const { versionId, setId } = await params;
  const actor = await requireActor();
  const view = await app().core.criteria.getCriteriaSet(actor, { setId }).catch(orNotFound);
  if (!view || view.version.id !== versionId) notFound();
  const { set } = view;
  const draft = view.version.status === "draft";
  // The check of this Bộ tiêu chí (and of the whole version), current after every edit (L19 AD-03).
  const issues = draft ? (await app().core.criteria.validateVersion(actor, { versionId })).issues.filter((i) => i.setId === null || i.setId === set.id) : [];
  const edit: EditSlot | undefined = draft ? (target) => <DraftControls versionId={versionId} target={target} /> : undefined;
  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-text-3">
        <Link href="/quan-tri/bo-tieu-chi">Phiên bản tiêu chí</Link> / <Link href={`/quan-tri/bo-tieu-chi/${versionId}`}>{view.version.legalBasis}</Link> / Bộ{" "}
        {set.code}
      </nav>
      <CriteriaSetHeading view={view} edit={edit} />
      {draft && <ValidationIssues versionId={versionId} issues={issues} scope="set" />}

      {draft && (
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

      <CriteriaSetSheet set={set} edit={edit} />
    </div>
  );
}
