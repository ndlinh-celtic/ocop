import { Copy } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { CopyWizard } from "./copy-wizard";

export const dynamic = "force-dynamic";

/**
 * S53 Sao chép sang phiếu chấm (L12 TM-08, TM-09; #58 stories 65 to 70, 77): the hồ sơ the Thành viên Tổ tư vấn
 * is Phân công on, with a Báo cáo Tổ tư vấn issued, in a đợt dựa trên Tổ tư vấn. A đợt chấm trực tiếp brings none,
 * so there is nothing to copy.
 */
export default async function AdvisoryCopyPage() {
  const actor = await requireActor();
  const rows = await app().core.scoring.advisoryCopyBoard(actor);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Sao chép sang phiếu chấm</h1>
        <p className="text-sm text-text-2">
          Đưa Điểm đề xuất và căn cứ của Báo cáo Tổ tư vấn đã phát hành vào Phiếu chấm của thành viên. Tiêu chí thành viên đã chỉnh và phiếu đã xác nhận được
          giữ nguyên.
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Copy} title="Chưa có hồ sơ để sao chép">
          Hồ sơ hiện ở đây khi Tổ trưởng đã phát hành Báo cáo Tổ tư vấn cho hồ sơ anh/chị được Phân công, trong đợt chấm dựa trên Tổ tư vấn.
        </EmptyState>
      ) : (
        <CopyWizard rows={rows} />
      )}
    </div>
  );
}
