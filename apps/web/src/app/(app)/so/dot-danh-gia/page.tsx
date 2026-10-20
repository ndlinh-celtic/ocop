import { can } from "@ocop/core";
import { CalendarRange } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { RoundStatusTag } from "@/components/rounds/round-status-tag";
import { formatVnDate } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/** S80: Đợt đánh giá with Trạng thái đợt, the three deadlines and Phiên bản tiêu chí (L07 SO-01). */
export default async function RoundsPage() {
  const actor = await requireActor();
  const rounds = await app().core.rounds.listRounds(actor);
  const open = rounds.find((r) => r.status === "open_for_submission");
  const manage = can(actor, "round.manage");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Đợt đánh giá</h1>
        {manage && (
          <Link href="/so/dot-danh-gia/moi" className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink">
            Tạo đợt
          </Link>
        )}
      </div>
      <p role="status" className="rounded-lg border bg-surface p-4 text-sm">
        {open ? (
          <>
            Đang nhận nộp: <span className="font-medium">{open.name}</span>, Hạn nộp xã {formatVnDate(open.submissionDeadline)}, Phiên bản tiêu chí{" "}
            {open.criteriaVersion.legalBasis}.
          </>
        ) : (
          "Hiện không có đợt nào đang nhận nộp."
        )}
      </p>
      {rounds.length === 0 ? (
        <EmptyState icon={CalendarRange} title="Chưa có đợt đánh giá">
          {manage ? "Tạo đợt ở trạng thái Nháp, kiểm tra các mốc hạn rồi mở đợt để chủ thể bắt đầu nộp hồ sơ." : "Sở NN&MT chưa tạo đợt nào."}
        </EmptyState>
      ) : (
        <section className="overflow-x-auto rounded-lg border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-4 py-2">Tên đợt</th>
                <th className="px-4 py-2">Năm</th>
                <th className="px-4 py-2">Trạng thái</th>
                <th className="px-4 py-2">Hạn nộp xã</th>
                <th className="px-4 py-2">Hạn gửi tỉnh</th>
                <th className="px-4 py-2">Hạn đánh giá tỉnh</th>
                <th className="px-4 py-2">Phiên bản tiêu chí</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/so/dot-danh-gia/${r.id}`} className="font-medium text-brand underline-offset-2 hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{r.year}</td>
                  <td className="px-4 py-2">
                    <RoundStatusTag status={r.status} />
                  </td>
                  <td className="px-4 py-2">{formatVnDate(r.submissionDeadline)}</td>
                  <td className="px-4 py-2">{formatVnDate(r.forwardingDeadline)}</td>
                  <td className="px-4 py-2">{formatVnDate(r.evaluationDeadline)}</td>
                  <td className="px-4 py-2">{r.criteriaVersion.legalBasis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
