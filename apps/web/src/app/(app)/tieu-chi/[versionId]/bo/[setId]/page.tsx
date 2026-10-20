import Link from "next/link";
import { notFound } from "next/navigation";
import { CriteriaSetHeading, CriteriaSetSheet } from "@/components/criteria/criteria-set-sheet";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/** A Bộ tiêu chí of a published version, read-only for every signed-in Người dùng (L19, spec #16 story 32). */
export default async function PublishedCriteriaSetPage({ params }: { params: Promise<{ versionId: string; setId: string }> }) {
  const { versionId, setId } = await params;
  const actor = await requireActor();
  const view = await app().core.criteria.getCriteriaSet(actor, { setId }).catch(orNotFound);
  if (!view || view.version.id !== versionId || view.version.status !== "published") notFound();
  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-text-3">
        <Link href="/tieu-chi">Bộ tiêu chí</Link> / <Link href={`/tieu-chi/${versionId}`}>{view.version.legalBasis}</Link> / Bộ {view.set.code}
      </nav>
      <CriteriaSetHeading view={view} />
      <CriteriaSetSheet set={view.set} />
    </div>
  );
}
