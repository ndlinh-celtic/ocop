import { defineModule } from "../shared/module";
import { advisoryCopyBoard, copyAdvisory, previewAdvisoryCopy } from "./advisory-copy";
import { advisoryReport, advisoryReportVersions, downloadAdvisoryFile, issueAdvisoryReport, reissueAdvisoryReport, saveAdvisoryDraft } from "./advisory-report";
import { finalizeDossier } from "./finalize";
import { attachMeetingMinutes, downloadMeetingMinutes, generateMeetingDocument } from "./meeting-documents";
import { addMeetingDossiers, closeMeeting, createMeeting, getMeeting, listMeetings, meetingOf, removeMeetingDossier } from "./meetings";
import { aggregateSummaries, gradingProgress, readDossierScores } from "./read";
import { returnScoreSheet, scoreSheetHistory } from "./return-sheet";
import { confirmScoreSheet, saveScoreSheet } from "./sheets";
import { finalizedResults, unlockFinalized, unlockTarget } from "./unlock";

export const scoringModule = defineModule({
  useCases: {
    readDossierScores,
    aggregateSummaries,
    saveScoreSheet,
    confirmScoreSheet,
    gradingProgress,
    // L10, L11 Báo cáo Tổ tư vấn (#56).
    advisoryReport,
    saveAdvisoryDraft,
    issueAdvisoryReport,
    reissueAdvisoryReport,
    advisoryReportVersions,
    downloadAdvisoryFile,
    // L15 Phiên họp and chốt điểm (#60).
    createMeeting,
    addMeetingDossiers,
    removeMeetingDossier,
    closeMeeting,
    listMeetings,
    getMeeting,
    meetingOf,
    finalize: finalizeDossier,
    // L15 HD-09 văn bản họp and biên bản đã ký (#62).
    generateMeetingDocument,
    attachMeetingMinutes,
    downloadMeetingMinutes,
    // L15 Trả phiếu (#61).
    returnScoreSheet,
    scoreSheetHistory,
    // L15 Mở khóa sau chốt (#63).
    unlockTarget,
    unlockFinalized,
    finalizedResults,
    // L12 sao chép sang Phiếu chấm (#58).
    advisoryCopyBoard,
    previewAdvisoryCopy,
    copyAdvisory,
  },
});
