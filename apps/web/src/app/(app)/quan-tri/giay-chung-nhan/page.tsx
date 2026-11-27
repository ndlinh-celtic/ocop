import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { CertificateSettingsForm, UnderperformingRatioForm } from "./settings-form";

export const dynamic = "force-dynamic";

/** L16 HD-11 (#84, story 35): cấu hình giấy chứng nhận, chung cho toàn hệ thống. */
export default async function CertificateSettingsPage() {
  const actor = await requireActor();
  const settings = await app().core.system.certificateSettings(actor);
  const { ratio } = await app().core.system.underperformingRatio(actor);
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Cấu hình giấy chứng nhận</h1>
      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
        <p className="text-sm text-text-2">
          Áp dụng cho giấy chứng nhận cấp từ nay. Giấy đã cấp giữ nguyên số hiệu. Mặc định: đuôi GCN-OCOP, hiệu lực 36 tháng, nhắc trước 6 tháng.
        </p>
        <CertificateSettingsForm settings={settings} />
      </section>
      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
        <h2 className="font-semibold">Tiêu chí dưới mức</h2>
        <p className="text-sm text-text-2">Tiêu chí có điểm trung bình dưới tỷ lệ này so với điểm tối đa được gợi ý vào Thư kết quả không đạt. Mặc định 50%.</p>
        <UnderperformingRatioForm ratio={ratio} />
      </section>
    </div>
  );
}
