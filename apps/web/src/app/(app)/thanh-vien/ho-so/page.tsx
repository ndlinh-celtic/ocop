import { AssignedDossierList } from "@/components/dossiers/assigned-dossier-list";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/** S60 Hồ sơ được Phân công, minimal (L09 HD-06, stories 41, 78): the hồ sơ Giao chấm to the thành viên. */
export default async function MemberDossiersPage() {
  const actor = await requireActor();
  const dossiers = await app().core.dossiers.list(actor);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Hồ sơ được phân công</h1>
        <p className="text-sm text-text-2">Hồ sơ Thư ký hội đồng đã Giao chấm cho anh/chị. Mỗi hồ sơ có một Phiếu chấm của anh/chị.</p>
      </div>
      <AssignedDossierList dossiers={dossiers} empty="Hồ sơ sẽ hiện ở đây khi Thư ký hội đồng Giao chấm hồ sơ có Phân công của anh/chị." />
    </div>
  );
}
