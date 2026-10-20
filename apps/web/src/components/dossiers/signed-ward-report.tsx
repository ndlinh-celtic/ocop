import type { WardReportStatus } from "@ocop/core";
import { DownloadButton } from "@/components/download-button";
import { formatVnDateTime } from "@/lib/format";
import { downloadSignedWardReportAction } from "./actions";

/** L06 XA-07 (story 35): the signed Báo cáo đánh giá cấp xã of a hồ sơ, shown to the xã and to the Chủ thể. */
export function SignedWardReport({ dossierId, signed }: { dossierId: string; signed: NonNullable<WardReportStatus["signed"]> }) {
  const download = downloadSignedWardReportAction.bind(null, dossierId);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>
        Báo cáo đánh giá cấp xã đã ký: <b>{signed.fileName}</b> (Phiên bản nộp {signed.submissionNumber}, tải lên lúc {formatVnDateTime(signed.uploadedAt)}).
      </span>
      {signed.status === "clean" ? (
        <DownloadButton fileId={signed.fileId} download={download} label="Tải bản đã ký (.pdf)" />
      ) : signed.status === "blocked" ? (
        <span className="text-danger">Tệp bị chặn vì không an toàn</span>
      ) : (
        <span className="text-amber">Đang quét virus</span>
      )}
    </div>
  );
}
