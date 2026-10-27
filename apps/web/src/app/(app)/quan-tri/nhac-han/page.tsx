import { DEFAULT_REMINDER_MILESTONES } from "@ocop/core";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { MilestonesForm } from "./milestones-form";

export const dynamic = "force-dynamic";

/** L03 CT-12 (story 37): the mốc nhắc hạn, chung cho toàn hệ thống. */
export default async function ReminderMilestonesPage() {
  const actor = await requireActor();
  const { days } = await app().core.system.reminderMilestones(actor);
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Mốc nhắc hạn</h1>
      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
        <p className="text-sm text-text-2">
          Hệ thống nhắc qua email và trong ứng dụng khi còn đúng số ngày này trước hạn: Chủ thể có hồ sơ Nháp trước Hạn nộp xã, Chủ thể có yêu cầu bổ sung trước
          hạn bổ sung, Cán bộ xã còn hồ sơ chưa gửi tỉnh trước Hạn gửi tỉnh. Mỗi mốc chỉ nhắc một lần. Mặc định: {DEFAULT_REMINDER_MILESTONES.join(", ")} ngày.
        </p>
        <MilestonesForm days={days} />
      </section>
    </div>
  );
}
