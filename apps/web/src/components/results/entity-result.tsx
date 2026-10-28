import type { PublishedLetter, PublishedResultView } from "@ocop/core";
import { downloadResultLetterAction } from "@/app/(app)/chu-the/ho-so/actions";
import { DownloadButton } from "@/components/download-button";
import { formatPoints } from "@/components/scoring/aggregate-table";
import { formatVnDateTime } from "@/lib/format";

/**
 * L16 CT-13 (#85, stories 44, 66): the newest Thư kết quả không đạt, with what it lists and its PDF; a thư đính chính
 * says why. Older phiên bản are not shown to the Chủ thể.
 */
function EntityLetter({ dossierId, letter }: { dossierId: string; letter: PublishedLetter }) {
  return (
    <div className="flex flex-col gap-2 border-t pt-3" data-testid="result-letter">
      <p className="font-medium">
        Thư kết quả{letter.n > 1 && ` (đính chính lần ${letter.n - 1})`} · phát hành lúc {formatVnDateTime(letter.issuedAt)}
      </p>
      {letter.reason && <p className="text-text-2">Lý do đính chính: {letter.reason}</p>}
      {letter.criteria.length > 0 && (
        <div>
          <p className="font-medium">Tiêu chí cần cải thiện</p>
          <ul className="mt-1 list-disc pl-5">
            {letter.criteria.map((c) => (
              <li key={c.code}>
                <b>{c.code}</b> {c.name}: {formatPoints(c.average)} / {formatPoints(c.maxPoints)} điểm
              </li>
            ))}
          </ul>
        </div>
      )}
      {letter.advice && (
        <div>
          <p className="font-medium">Lời khuyên của Sở</p>
          <p className="whitespace-pre-line text-text-2">{letter.advice}</p>
        </div>
      )}
      <p className="text-text-2">Anh/chị có thể hoàn thiện sản phẩm và nộp lại hồ sơ ở đợt đánh giá sau.</p>
      <DownloadButton fileId={dossierId} download={downloadResultLetterAction} label="Tải Thư kết quả (PDF)" />
    </div>
  );
}

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
      {view.recognizedStar !== null && view.recognizedStar < view.star && (
        // ADR 0009 (#88): Hạng công nhận 4 of a hồ sơ 5 sao Trung ương chuyển về; the Hạng sao of its kết quả stays.
        <p className="text-text-2">
          Hạng sao theo kết quả chấm: {view.star} sao. Trung ương chuyển về, tỉnh công nhận {view.recognizedStar} sao theo Quyết định công nhận bổ sung.
        </p>
      )}
      <p>
        {formatPoints(view.total)} điểm ({view.parts.map((p) => `Phần ${p.code} ${formatPoints(p.total)}`).join(", ")}).
      </p>
      <p className="text-text-2">Công bố lúc {formatVnDateTime(view.publishedAt)}.</p>
      <div>
        <p className="font-medium">Nhận xét chung của Hội đồng</p>
        <p className="whitespace-pre-line text-text-2">{view.generalComment || "Hội đồng không có nhận xét chung."}</p>
      </div>
      {view.letter && <EntityLetter dossierId={view.dossierId} letter={view.letter} />}
    </section>
  );
}
