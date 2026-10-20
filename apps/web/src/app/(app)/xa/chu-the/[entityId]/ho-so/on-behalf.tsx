import { can, onBehalfOf } from "@ocop/core";
import { UserCog } from "lucide-react";
import { notFound } from "next/navigation";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

/**
 * L01 Nhập hộ (stories 72 to 75): the Cán bộ xã acting for Chủ thể `entityId`, and that Chủ thể as the
 * officer sees it. Not found unless the Chủ thể is đăng ký ở xã of the officer: one that only has a hồ sơ
 * here, moved by Chuyển xã, is not theirs to act for.
 */
export async function onBehalfContext(entityId: string) {
  const officer = await requireActor();
  const actor = onBehalfOf(officer, entityId);
  if (!can(actor, "dossier.read")) notFound();
  const entity = await app().core.entities.getEntity(officer, { entityId }).catch(orNotFound);
  if (!entity || entity.ward.id !== officer.activeScope?.id) notFound();
  return { actor, entity };
}

/** Says, on every Nhập hộ page, that what is done here is recorded as the officer's, for the Chủ thể. */
export function OnBehalfNotice({ entityName }: { entityName: string }) {
  return (
    <p role="note" className="flex items-start gap-3 rounded-lg bg-amber-soft p-4 text-sm">
      <UserCog className="size-5 shrink-0 text-amber" aria-hidden />
      <span>
        Bạn đang <b>Nhập hộ</b> cho Chủ thể <b>{entityName}</b>. Mọi thao tác được ghi nhận là của bạn thay mặt Chủ thể và hiện trên dòng thời gian của hồ sơ.
      </span>
    </p>
  );
}
