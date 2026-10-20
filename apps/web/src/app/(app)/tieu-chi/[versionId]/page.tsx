import Link from "next/link";
import { notFound } from "next/navigation";
import { orNotFound } from "@/components/criteria/not-found";
import { VersionOverview } from "@/components/criteria/version-overview";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/** Cây phân loại of a published Phiên bản tiêu chí, read-only for every signed-in Người dùng (L19). */
export default async function PublishedVersionPage({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const actor = await requireActor();
  const version = await app().core.criteria.getVersion(actor, { versionId }).catch(orNotFound);
  // Quản trị may read drafts, but drafts are edited under /quan-tri, not shown here.
  if (!version || version.status !== "published") notFound();
  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-text-3">
        <Link href="/tieu-chi">Bộ tiêu chí</Link> / {version.legalBasis}
      </nav>
      <h1 className="text-xl font-semibold">{version.legalBasis}</h1>
      <VersionOverview version={version} setHref={(setId) => `/tieu-chi/${version.id}/bo/${setId}`} />
    </div>
  );
}
