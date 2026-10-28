import type { Repos } from "@ocop/core";
import type { Db } from "../db/types";
import { auditRepo } from "./audit";
import { auditChainRepo } from "./audit-chain";
import { criteriaVersionRepo } from "./criteria";
import { fileRepo } from "./files";
import { oneTimeTokenRepo, roleAssignmentRepo, sessionRepo, userRepo } from "./identity";
import { notificationRepo } from "./notifications";
import { wardRepo } from "./org";
import { emailDeliveriesRepo, outboxRepo, processedEventsRepo } from "./platform";
import { roundRepo } from "./rounds";
import { entityRepo, legalDocumentRepo } from "./entities";
import { rateLimitRepo } from "./rate-limits";
import { dossierRepo } from "./dossiers";
import { supplementRepo } from "./supplements";
import { reminderRepo, systemSettingRepo } from "./reminders";
import { assignmentRepo, councilRepo, scoreSheetRepo } from "./councils";
import { advisoryReportRepo } from "./advisory-reports";
import { aggregateResultRepo, meetingRepo } from "./meetings";
import { templateVersionRepo } from "./template-versions";
import { recognitionDecisionRepo } from "./recognition-decisions";
import { fiveStarRepo } from "./five-star";
import { fiveStarPackageRepo } from "./five-star-packages";

export function buildRepos(db: Db): Repos {
  return {
    users: userRepo(db),
    roleAssignments: roleAssignmentRepo(db),
    sessions: sessionRepo(db),
    oneTimeTokens: oneTimeTokenRepo(db),
    wards: wardRepo(db),
    notifications: notificationRepo(db),
    audit: auditRepo(db),
    auditChain: auditChainRepo(db),
    outbox: outboxRepo(db),
    processedEvents: processedEventsRepo(db),
    emailDeliveries: emailDeliveriesRepo(db),
    files: fileRepo(db),
    criteriaVersions: criteriaVersionRepo(db),
    rounds: roundRepo(db),
    entities: entityRepo(db),
    legalDocuments: legalDocumentRepo(db),
    rateLimits: rateLimitRepo(db),
    dossiers: dossierRepo(db),
    supplements: supplementRepo(db),
    reminders: reminderRepo(db),
    systemSettings: systemSettingRepo(db),
    councils: councilRepo(db),
    assignments: assignmentRepo(db),
    scoreSheets: scoreSheetRepo(db),
    advisoryReports: advisoryReportRepo(db),
    meetings: meetingRepo(db),
    aggregateResults: aggregateResultRepo(db),
    templateVersions: templateVersionRepo(db),
    recognitionDecisions: recognitionDecisionRepo(db),
    fiveStar: fiveStarRepo(db),
    fiveStarPackages: fiveStarPackageRepo(db),
  };
}
