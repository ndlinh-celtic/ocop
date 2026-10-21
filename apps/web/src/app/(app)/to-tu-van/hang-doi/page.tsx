import { AssignedDossierList } from "@/components/dossiers/assigned-dossier-list";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * S50 Hàng đợi thẩm định (L09 HD-06, L10; stories 41, 42): the hồ sơ Giao chấm to the Thành viên Tổ tư vấn, the
 * soonest Hạn đánh giá tỉnh of their đợt first, each opening its S51 thẩm định (#56).
 */
export default async function AdvisoryQueuePage() {
  const actor = await requireActor();
  const [dossiers, rounds] = await Promise.all([app().core.dossiers.list(actor), app().core.rounds.listRounds(actor)]);
  const deadline = new Map(rounds.map((r) => [r.id, r.evaluationDeadline.getTime()]));
  const due = (roundId: string | null) => (roundId ? (deadline.get(roundId) ?? Infinity) : Infinity);
  const sorted = [...dossiers].sort((a, b) => due(a.roundId) - due(b.roundId));
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Hàng đợi thẩm định</h1>
        <p className="text-sm text-text-2">Hồ sơ Thư ký hội đồng đã Giao chấm cho Tổ tư vấn, hạn đánh giá gần nhất lên trước.</p>
      </div>
      <AssignedDossierList dossiers={sorted} empty="Hồ sơ sẽ hiện ở đây khi Thư ký hội đồng Giao chấm hồ sơ có Phân công Tổ tư vấn của anh/chị."
        hrefOf={(id) => `/to-tu-van/ho-so/${id}`}
      />
    </div>
  );
}
