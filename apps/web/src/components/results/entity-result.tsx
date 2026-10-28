import type { PublishedResultView } from "@ocop/core";
import { formatPoints } from "@/components/scoring/aggregate-table";
import { formatVnDateTime } from "@/lib/format";

/**
 * L16 CT-13 (#83, spec #79 stories 60, 62, 64): the kết quả as the Chủ thể sees it. From Công bố kết quả the điểm tổng
 * hợp, điểm theo Phần, Hạng công nhận (or đạt điểm, tỉnh đề nghị Trung ương đánh giá 5 sao) and Nhận xét chung; before,
 * only that the Hội đồng has chốt điểm and the quyết định is awaited. Never a thành viên or a phiếu.
 */
export function EntityResult({ view }: { view: PublishedResultView | null }) {
  if (!view) {
    return (
      <section className="rounded-lg border bg-surface p-4 text-sm shadow-card" data-testid="entity-result">
        <h2 className="font-semibold">Kết quả đánh giá</h2>
        <p className="mt-1 text-text-2">Đã chốt điểm, chờ quyết định. Kết quả sẽ hiện ở đây khi được công bố.</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-surface p-4 text-sm shadow-card" data-testid="entity-result">
      <h2 className="font-semibold">Kết quả đánh giá</h2>
      <p className="text-base font-semibold text-brand">{view.standing}</p>
      <p>
        {formatPoints(view.total)} điểm ({view.parts.map((p) => `Phần ${p.code} ${formatPoints(p.total)}`).join(", ")}).
      </p>
      <p className="text-text-2">Công bố lúc {formatVnDateTime(view.publishedAt)}.</p>
      <div>
        <p className="font-medium">Nhận xét chung của Hội đồng</p>
        <p className="whitespace-pre-line text-text-2">{view.generalComment || "Hội đồng không có nhận xét chung."}</p>
      </div>
    </section>
  );
}
