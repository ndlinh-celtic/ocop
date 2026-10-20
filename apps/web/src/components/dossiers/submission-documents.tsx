import { DownloadButton } from "@/components/download-button";
import { downloadSubmissionDocumentAction } from "./actions";

/** #37: the Phiếu đăng ký and Báo cáo tự đánh giá generated with one Phiên bản nộp, as Word files. */
export function SubmissionDocuments({ dossierId, submissionNumber }: { dossierId: string; submissionNumber: number }) {
  const download = downloadSubmissionDocumentAction.bind(null, dossierId, submissionNumber);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DownloadButton fileId="registration_form" download={download} label="Phiếu đăng ký (.docx)" />
      <DownloadButton fileId="self_assessment_report" download={download} label="Báo cáo tự đánh giá (.docx)" />
    </div>
  );
}
