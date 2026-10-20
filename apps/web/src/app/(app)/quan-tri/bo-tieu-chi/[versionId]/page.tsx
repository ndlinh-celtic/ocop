import Link from "next/link";
import { notFound } from "next/navigation";
import { orNotFound } from "@/lib/not-found";
import { StatusTag } from "@/components/criteria/status-tag";
import { VersionOverview } from "@/components/criteria/version-overview";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { DraftControls } from "./draft-controls";
import { PublishButton } from "./publish-button";
import { ValidationIssues } from "./validation-issues";

export const dynamic = "force-dynamic";

/** S72: one Phiên bản tiêu chí; a draft is editable (AD-03) and shows its check and the publish button (AD-04). */
export default async function CriteriaVersionPage({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const actor = await requireActor();
  const version = await app().core.criteria.getVersion(actor, { versionId }).catch(orNotFound);
  if (!version) notFound();
  const check = version.status === "draft" ? await app().core.criteria.validateVersion(actor, { versionId }) : null;
  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-text-3">
        <Link href="/quan-tri/bo-tieu-chi">Phiên bản tiêu chí</Link> / {version.legalBasis}
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{version.legalBasis}</h1>
        <StatusTag status={version.status} />
        {check && <PublishButton versionId={version.id} disabled={check.issues.length > 0} />}
      </div>
      {version.copiedFrom && (
        <p className="text-sm text-text-2">
          Sao chép từ{" "}
          <Link href={`/quan-tri/bo-tieu-chi/${version.copiedFrom}`} className="text-brand underline-offset-2 hover:underline">
            một phiên bản khác
          </Link>{" "}
          (chỉ để tra cứu; phiên bản nguồn có thể đã bị xóa).
        </p>
      )}
      {check && <ValidationIssues versionId={version.id} issues={check.issues} />}
      <VersionOverview
        version={version}
        setHref={(setId) => `/quan-tri/bo-tieu-chi/${version.id}/bo/${setId}`}
        edit={check ? (target) => <DraftControls versionId={version.id} target={target} /> : undefined}
      />
    </div>
  );
}
