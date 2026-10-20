import { can } from "@ocop/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { CreateEntityForm } from "./create-entity-form";

export const dynamic = "force-dynamic";

/** L01 (story 11): a Cán bộ xã opens a Chủ thể for a hộ sản xuất of their xã that cannot register itself. */
export default async function CreateEntityPage() {
  const actor = await requireActor();
  if (!can(actor, "entity.create") || actor.activeScope?.type !== "ward") notFound();
  const ward = (await app().core.org.listWards()).find((w) => w.id === actor.activeScope!.id);
  if (!ward) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/xa/chu-the" className="text-sm text-brand">
          ← Chủ thể của xã
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Tạo Chủ thể</h1>
        <p className="text-sm text-text-2">Hỗ trợ hộ sản xuất chưa tự đăng ký được. Chủ thể được đăng ký ở {ward.name}.</p>
      </div>
      <section className="rounded-lg border bg-surface p-4 shadow-card">
        <CreateEntityForm wardName={ward.name} />
      </section>
    </div>
  );
}
