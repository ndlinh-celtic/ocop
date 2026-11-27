import { defineModule } from "../shared/module";
import { REMINDER_MILESTONES } from "./reminder-milestones";
import { assessChecklist, dossierChecklist } from "./checklist";
import { copyDossier, createDossier, creationOptions } from "./create";
import { downloadSubmissionDocument } from "./documents";
import { addEvidenceFile, deleteDossier, updateProduct } from "./edit";
import { exportDossiers } from "./export";
import { emailDossierEvent, NOTICE_EVENTS, notifyDossierEvent } from "./notices";
import { receiveAtProvince } from "./province";
import { dossierTimeline, getDossier, listDossiers, provinceOverview } from "./read";
import { rejectDossier, transferWard } from "./reject-transfer";
import { emailReminder, notifyReminder, sendDueReminders } from "./reminders";
import { listAdvisoryReturnRequests, listReturnRequests, requestAdvisoryReturn, requestReturn } from "./return-request";
import { roundTransferTargets, transferRound } from "./round-transfer";
import { explainCriterion, linkEvidence, removeEvidenceFile, selfAssessment, selfScore } from "./self-assessment";
import { listSubmissions, submissionCheck, submitDossier, withdrawDossier } from "./submit";
import { closeUnsupplemented, listSupplementRequests, requestSupplement, respondSupplementItem, returnFromProvince } from "./supplement";
import { changeHandler, listHandlers, receiveDossier } from "./ward";
import { attachSignedWardReport, downloadSignedWardReport, forwardToProvince, generateWardReport, wardReportStatus } from "./ward-report";

export const dossiersModule = defineModule({
  useCases: {
    // Story 37: mốc nhắc hạn, a Cấu hình chung of Quản trị.
    reminderMilestones: REMINDER_MILESTONES.read,
    setReminderMilestones: REMINDER_MILESTONES.write,
    creationOptions,
    create: createDossier,
    copy: copyDossier,
    get: getDossier,
    list: listDossiers,
    // L22 DC-05 Xuất Excel danh sách hồ sơ (#90).
    exportDossiers,
    timeline: dossierTimeline,
    updateProduct,
    addEvidenceFile,
    removeEvidenceFile,
    linkEvidence,
    selfScore,
    explainCriterion,
    selfAssessment,
    delete: deleteDossier,
    submissionCheck,
    submit: submitDossier,
    withdraw: withdrawDossier,
    submissions: listSubmissions,
    receive: receiveDossier,
    reject: rejectDossier,
    transferWard,
    transferRound,
    roundTransferTargets,
    changeHandler,
    handlers: listHandlers,
    downloadSubmissionDocument,
    requestSupplement,
    returnFromProvince,
    receiveAtProvince,
    requestReturn,
    returnRequests: listReturnRequests,
    requestAdvisoryReturn,
    advisoryReturnRequests: listAdvisoryReturnRequests,
    respondSupplementItem,
    supplementRequests: listSupplementRequests,
    closeUnsupplemented,
    checklist: dossierChecklist,
    assessChecklist,
    generateWardReport,
    attachSignedWardReport,
    wardReport: wardReportStatus,
    downloadSignedWardReport,
    forwardToProvince,
    provinceOverview,
    sendDueReminders,
  },
  jobs: {
    // L03 CT-12: nhắc hạn by calendar day in Vietnam. Hourly in office hours so a missed run catches up the same day;
    // each mốc goes out once however often it runs.
    "dossiers.due-reminders": { cron: "0 8-20 * * *", run: sendDueReminders },
  },
  consumers: {
    // Story 86: who hears of what happens to a hồ sơ (dossiers/notices.ts).
    "notifications.dossier": { events: NOTICE_EVENTS, handle: notifyDossierEvent },
    "dossiers.notice-email": { events: NOTICE_EVENTS, handle: emailDossierEvent },
    // L03 CT-12 (dossiers/reminders.ts): nhắc hạn, in the app and by email.
    "notifications.dossier-reminder": { events: ["dossier.reminder_due"], handle: notifyReminder },
    "dossiers.reminder-email": { events: ["dossier.reminder_due"], handle: emailReminder },
  },
});
