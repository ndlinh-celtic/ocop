import { EVIDENCE_ASSESSMENT_LABEL, type AdvisoryReportVersionView } from "@ocop/core";
import { DownloadButton } from "@/components/download-button";
import { formatVnDateTime } from "@/lib/format";
import { downloadAdvisoryFileAction } from "./actions";

/**
 * One issued phiên bản of a Báo cáo Tổ tư vấn (L11, #56 stories 59, 63), read-only: who issued it and when, why
 * when it is N+1, Điểm đề xuất with căn cứ by Tiêu chí, the sums, nhận xét and tệp đính kèm.
 */
export function AdvisoryReportVersion({ dossierId, version, open = false }: { dossierId: string; version: AdvisoryReportVersionView; open?: boolean }) {
  const { report } = version;
  const download = downloadAdvisoryFileAction.bind(null, dossierId);
  return (
    <details open={open} className="rounded-lg border bg-surface shadow-card" data-testid="advisory-version">
      <summary className="cursor-pointer p-4">
        <span className="font-semibold">Phiên bản {version.number}</span>
        <span className="text-sm text-text-2">
          {" "}
          · phát hành lúc {formatVnDateTime(version.issuedAt)} bởi {version.issuedBy.fullName} · {report.estimate.total} điểm, ước lượng {report.estimate.star}{" "}
          sao
        </span>
        {version.reason && <p className="mt-1 text-sm text-text-2">Lý do phát hành lại: {version.reason}</p>}
      </summary>
      <div className="flex flex-col gap-4 border-t p-4 text-sm">
        <p className="text-text-2">
          {report.estimate.parts.map((p) => `Phần ${p.code}: ${p.total}`).join(" · ")} · Tổng {report.estimate.total}
          {report.submissionNumber !== null && ` · thẩm định Phiên bản nộp ${report.submissionNumber}`}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-3 py-2">Tiêu chí</th>
                <th className="px-3 py-2">Điểm đề xuất</th>
                <th className="px-3 py-2">Căn cứ</th>
                <th className="px-3 py-2">Minh chứng</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.map((l) => (
                <tr key={l.criterionId} className="border-b align-top last:border-0">
                  <td className="px-3 py-2">
                    <b>{l.code}</b> {l.name} <span className="text-text-3">(tối đa {l.maxPoints})</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <b>{l.points}</b> <span className="text-text-3">{l.levelDescription}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-pre-line">{l.basis}</td>
                  <td className="px-3 py-2">
                    {l.evidenceAssessment && <p className="font-medium">{EVIDENCE_ASSESSMENT_LABEL[l.evidenceAssessment]}</p>}
                    {l.evidence.map((e) => (
                      <p key={e.fileId}>{e.fileName}</p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="font-semibold">Nhận xét tổng hợp</h3>
          <p className="whitespace-pre-line">{report.summary || "—"}</p>
        </div>
        <div>
          <h3 className="font-semibold">Điểm cần hội đồng lưu ý</h3>
          <p className="whitespace-pre-line">{report.notes || "—"}</p>
        </div>
        {report.attachments.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold">Tệp đính kèm thực địa</h3>
            {report.attachments.map((a) => (
              <div key={a.fileId} className="flex flex-wrap items-center gap-2">
                <span>{a.fileName}</span>
                <DownloadButton fileId={a.fileId} download={download} />
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
