import { FolderOpen } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { DossierTable } from "./dossier-table";

export const dynamic = "force-dynamic";

/** S12 Hồ sơ của tôi (L02 CT-03): every hồ sơ of the signed-in Chủ thể, newest first. */
export default async function MyDossiersPage() {
  const actor = await requireActor();
  const dossiers = await app().core.dossiers.list(actor);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Hồ sơ của tôi</h1>
        <Link href="/chu-the/ho-so/moi" className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink">
          Tạo hồ sơ
        </Link>
      </div>
      {dossiers.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Chưa có hồ sơ nào">
          Tạo hồ sơ cho một sản phẩm bằng cách chọn Bộ tiêu chí phù hợp. Cần có đủ giấy tờ pháp lý bắt buộc còn hiệu lực trước khi tạo.
        </EmptyState>
      ) : (
        <DossierTable dossiers={dossiers} home="/chu-the/ho-so" />
      )}
    </div>
  );
}
