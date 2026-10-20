import { FolderOpen } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { dossierHome } from "@/lib/dossier-paths";
import { app } from "@/server/app";
import { DossierTable } from "@/app/(app)/chu-the/ho-so/dossier-table";
import { OnBehalfNotice, onBehalfContext } from "./on-behalf";

export const dynamic = "force-dynamic";

/** L01 Nhập hộ (story 72): every hồ sơ of a Chủ thể đăng ký ở xã mình, Nháp included, to work on for it. */
export default async function OnBehalfDossiersPage({ params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;
  const { actor, entity } = await onBehalfContext(entityId);
  const dossiers = await app().core.dossiers.list(actor);
  const home = dossierHome(entityId);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/xa/chu-the/${entityId}`} className="text-sm text-brand">
            ← {entity.name}
          </Link>
          <h1 className="mt-1 text-xl font-semibold">Hồ sơ của {entity.name}</h1>
        </div>
        <Link href={`${home}/moi`} className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink">
          Tạo hồ sơ hộ
        </Link>
      </div>
      <OnBehalfNotice entityName={entity.name} />
      {dossiers.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Chủ thể chưa có hồ sơ nào">
          Tạo hồ sơ hộ Chủ thể bằng cách chọn Bộ tiêu chí phù hợp. Chủ thể cần có đủ giấy tờ pháp lý bắt buộc còn hiệu lực.
        </EmptyState>
      ) : (
        <DossierTable dossiers={dossiers} home={home} />
      )}
    </div>
  );
}
