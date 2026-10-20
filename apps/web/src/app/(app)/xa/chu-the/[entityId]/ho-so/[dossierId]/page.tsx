import Link from "next/link";
import { dossierHome } from "@/lib/dossier-paths";
import { DossierEditor } from "@/app/(app)/chu-the/ho-so/[dossierId]/dossier-editor";
import { OnBehalfNotice, onBehalfContext } from "../on-behalf";

export const dynamic = "force-dynamic";

/** L01 Nhập hộ (story 72): S14 Trình soạn hồ sơ, by the Cán bộ xã for a Chủ thể đăng ký ở xã mình. */
export default async function OnBehalfDossierPage({ params }: { params: Promise<{ entityId: string; dossierId: string }> }) {
  const { entityId, dossierId } = await params;
  const { actor, entity } = await onBehalfContext(entityId);
  return (
    <DossierEditor
      actor={actor}
      dossierId={dossierId}
      onBehalf={entityId}
      notice={<OnBehalfNotice entityName={entity.name} />}
      back={
        <Link href={dossierHome(entityId)} className="text-sm text-brand">
          ← Hồ sơ của {entity.name}
        </Link>
      }
    />
  );
}
