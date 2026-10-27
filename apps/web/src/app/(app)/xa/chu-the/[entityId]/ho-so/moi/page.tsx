import Link from "next/link";
import { dossierHome } from "@/lib/dossier-paths";
import { NewDossier } from "@/app/(app)/chu-the/ho-so/moi/new-dossier";
import { OnBehalfNotice, onBehalfContext } from "../on-behalf";

export const dynamic = "force-dynamic";

/** L01 Nhập hộ (story 72): S13 Tạo hồ sơ, by the Cán bộ xã for a Chủ thể đăng ký ở xã mình. */
export default async function OnBehalfNewDossierPage({
  params,
  searchParams,
}: {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<{ tu?: string }>;
}) {
  const { entityId } = await params;
  const { tu } = await searchParams;
  const { actor, entity } = await onBehalfContext(entityId);
  return (
    <div className="flex flex-col gap-6">
      <OnBehalfNotice entityName={entity.name} />
      <NewDossier
        actor={actor}
        tu={tu}
        onBehalf={entityId}
        back={
          <Link href={dossierHome(entityId)} className="text-sm text-brand">
            ← Hồ sơ của {entity.name}
          </Link>
        }
      />
    </div>
  );
}
