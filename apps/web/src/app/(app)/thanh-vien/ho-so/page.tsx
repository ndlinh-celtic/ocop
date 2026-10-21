import { AssignedDossierList } from "@/components/dossiers/assigned-dossier-list";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

const SHEET_STATE = { draft: "Đang chấm", confirmed: "Đã xác nhận", absent: "Vắng", superseded: "Bị thay thế" } as const;

/** S60 Hồ sơ được Phân công (L09 HD-06, L14; stories 41, 78): the hồ sơ Giao chấm to the thành viên, with their phiếu's state. */
export default async function MemberDossiersPage() {
  const actor = await requireActor();
  const dossiers = await app().core.dossiers.list(actor);
  // Story 78: the state of the reader's own Phiếu chấm on each hồ sơ.
  const views = await Promise.all(dossiers.map((d) => app().core.scoring.readDossierScores(actor, { dossierId: d.id, ownSheet: true })));
  const sheetState = Object.fromEntries(
    views.flatMap((v) => (v.kind === "own_sheet" ? [[v.dossierId, v.sheet ? SHEET_STATE[v.sheet.state] : "Chưa có phiếu"] as const] : [])),
  );
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Hồ sơ được phân công</h1>
        <p className="text-sm text-text-2">Hồ sơ Thư ký hội đồng đã Giao chấm cho anh/chị. Mỗi hồ sơ có một Phiếu chấm của anh/chị.</p>
      </div>
      <AssignedDossierList dossiers={dossiers} href={(id) => `/thanh-vien/ho-so/${id}`} sheetState={sheetState} empty="Hồ sơ sẽ hiện ở đây khi Thư ký hội đồng Giao chấm hồ sơ có Phân công của anh/chị." />
    </div>
  );
}
