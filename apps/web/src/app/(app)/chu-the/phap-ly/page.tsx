import { notFound } from "next/navigation";
import { EntityProfile } from "@/components/entities/entity-profile";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * S11 Hồ sơ pháp lý of the signed-in Chủ thể: its organisation details (L01 CT-01). The Chủ thể is the
 * Phạm vi of the Vai trò đang dùng; giấy tờ pháp lý (CT-02) join this page in their own ticket.
 */
export default async function LegalProfilePage() {
  const actor = await requireActor();
  const entityId = actor.activeScope?.type === "entity" ? actor.activeScope.id : null;
  if (!entityId) notFound();
  const entity = await app().core.entities.getEntity(actor, { entityId }).catch(orNotFound);
  if (!entity) notFound();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Hồ sơ pháp lý</h1>
        <p className="text-sm text-text-2">Thông tin của {entity.name}, dùng chung cho tất cả hồ sơ sản phẩm.</p>
      </div>
      <EntityProfile entity={entity} email={actor.email} />
    </div>
  );
}
