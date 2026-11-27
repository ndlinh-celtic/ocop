import { defineModule } from "../shared/module";
import { CERTIFICATE_SETTINGS } from "./certificate-settings";
import { UNDERPERFORMING_RATIO } from "./underperforming-ratio";
import { amendDecision } from "./amend-decision";
import { certificateDrafts, downloadCertificate, draftCertificate, listCertificates, uploadSignedCertificate } from "./certificate";
import { emailCertificateExpiry, notifyCertificateExpiry, sendCertificateExpiryReminders } from "./certificate-expiry";
import { downloadDecision, meetingDecision, meetingsForDecision, recordMeetingDecision } from "./decision";
import { closeFiveStar, downloadMinistryDocument, fiveStarList, markFiveStarSent, returnFiveStarToProvince } from "./five-star";
import {
  buildFiveStarPackage,
  downloadFiveStarPackage,
  fiveStarPackages,
  notifyFiveStarPackage,
  removeAllExpiredFiveStarPackages,
  removeExpiredFiveStarPackages,
  requestFiveStarPackage,
} from "./five-star-package";
import { editGeneralComment } from "./general-comment";
import { downloadResultLetter, issueResultLetter, previewResultLetter, resultLetterDraft } from "./result-letter";
import { exportStarList } from "./star-list";
import { recordSupplementaryDecision, supplementaryDecisionDraft, supplementaryDecisions } from "./supplementary-decision";

export const resultsModule = defineModule({
  // Bước 5 Kết quả (spec #79).
  useCases: {
    // L16 Nhận xét chung (#80).
    editGeneralComment,
    // L16 HD-11 Quyết định công nhận theo Phiên họp and Công bố kết quả (#83).
    recordMeetingDecision,
    meetingsForDecision,
    meetingDecision,
    downloadDecision,
    // L17 SO-04 Đề xuất 5 sao: đánh dấu đã gửi, chuyển về, đóng hồ sơ (#87).
    fiveStarList,
    markFiveStarSent,
    returnFiveStarToProvince,
    closeFiveStar,
    downloadMinistryDocument,
    // L16 HD-11 Giấy chứng nhận, sửa số hoặc ngày ký quyết định (#84).
    amendDecision,
    listCertificates,
    uploadSignedCertificate,
    downloadCertificate,
    certificateDrafts,
    // L16 HD-10, CT-13 Thư kết quả không đạt (#85).
    resultLetterDraft,
    previewResultLetter,
    issueResultLetter,
    downloadResultLetter,
    // L16 nhắc Giấy chứng nhận sắp hết hiệu lực, the daily worker job (#86).
    sendCertificateExpiryReminders,
    // L17 Quyết định công nhận bổ sung (#88).
    recordSupplementaryDecision,
    supplementaryDecisionDraft,
    supplementaryDecisions,
    // L17 SO-04 Gói đề nghị 5 sao (#89).
    requestFiveStarPackage,
    fiveStarPackages,
    downloadFiveStarPackage,
    // The hourly worker job that deletes packages past their hạn tải.
    removeExpiredFiveStarPackages,
    // L22 DC-05 Xuất Excel danh sách sản phẩm đạt sao (#91).
    exportStarList,
    // Cấu hình chung of Quản trị: Tiêu chí dưới mức (#80) and Giấy chứng nhận (#84).
    underperformingRatio: UNDERPERFORMING_RATIO.read,
    setUnderperformingRatio: UNDERPERFORMING_RATIO.write,
    certificateSettings: CERTIFICATE_SETTINGS.read,
    setCertificateSettings: CERTIFICATE_SETTINGS.write,
  },
  jobs: {
    // L16 (#86): nhắc Giấy chứng nhận sắp hết hiệu lực, daily; a giấy whose day has passed unreminded goes out on the next
    // run, and the ledger keeps it to one reminder per ngày hết hiệu lực.
    "results.certificate-expiry-reminders": { cron: "0 8 * * *", run: sendCertificateExpiryReminders },
    // L17 SO-04 (#89): delete the Gói đề nghị 5 sao past their hạn tải, hourly. This job, not a bucket lifecycle rule
    // (domestic S3 may lack one), is what removes them; downloads are refused from `expiresAt` either way.
    "results.five-star-packages-expire": { cron: "17 * * * *", run: removeAllExpiredFiveStarPackages },
  },
  consumers: {
    // L16 HD-11 (#84): the bản nháp PDF of a Giấy chứng nhận, outside the transaction that issued it.
    "results.certificate-draft": { events: ["certificate.issued", "certificate.amended"], handle: draftCertificate },
    // L16 (#86): nhắc Giấy chứng nhận sắp hết hiệu lực, in the app and by email.
    "notifications.certificate-expiry": { events: ["certificate.expiry_due"], handle: notifyCertificateExpiry },
    "results.certificate-expiry-email": { events: ["certificate.expiry_due"], handle: emailCertificateExpiry },
    // L17 SO-04 Gói đề nghị 5 sao (#89): the build job, then the notice in the app.
    "results.five-star-package": { events: ["five_star_package.requested"], handle: buildFiveStarPackage },
    "notifications.five-star-package": { events: ["five_star_package.ready", "five_star_package.failed"], handle: notifyFiveStarPackage },
  },
});
