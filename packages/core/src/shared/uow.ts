import type { AuditLog } from "../audit/audit";
import type { AuditChainRepo } from "../audit/chain-repo";
import type { CriteriaVersionRepo } from "../criteria/version";
import type { FileRepo } from "../files/model";
import type { RoleAssignmentRepo, SessionRepo, UserRepo } from "../identity/repos";
import type { OneTimeTokenRepo } from "../identity/tokens";
import type { NotificationRepo } from "../notifications/notification";
import type { WardRepo } from "../org/ward";
import type { Outbox, ProcessedEvents } from "../platform/events";
import type { RoundRepo } from "../rounds/model";
import type { EmailDeliveries } from "../platform/mail";
import type { EntityRepo } from "../entities/model";
import type { LegalDocumentRepo } from "../entities/legal";
import type { RateLimitRepo } from "../platform/rate-limit";
import type { DossierRepo } from "../dossiers/model";
import type { SupplementRepo } from "../dossiers/supplement-model";
import type { ReminderRepo } from "../dossiers/reminder-model";
import type { SystemSettingRepo } from "../system/settings-model";
import type { CouncilRepo } from "../councils/model";
import type { AssignmentRepo } from "../councils/assignment-model";
import type { AdvisoryReportRepo } from "../scoring/advisory-report-model";
import type { ScoreSheetRepo } from "../scoring/score-sheet-model";
import type { AggregateResultRepo, MeetingRepo } from "../scoring/meeting-model";
import type { TemplateVersionRepo } from "../documents/template-version-model";
import type { RecognitionDecisionRepo } from "../results/decision-model";
import type { CertificateRepo } from "../results/certificate-model";

/** The repositories of one database transaction. */
export interface Repos {
  users: UserRepo;
  roleAssignments: RoleAssignmentRepo;
  sessions: SessionRepo;
  oneTimeTokens: OneTimeTokenRepo;
  wards: WardRepo;
  notifications: NotificationRepo;
  audit: AuditLog;
  auditChain: AuditChainRepo;
  outbox: Outbox;
  processedEvents: ProcessedEvents;
  emailDeliveries: EmailDeliveries;
  files: FileRepo;
  criteriaVersions: CriteriaVersionRepo;
  rounds: RoundRepo;
  entities: EntityRepo;
  legalDocuments: LegalDocumentRepo;
  rateLimits: RateLimitRepo;
  dossiers: DossierRepo;
  supplements: SupplementRepo;
  reminders: ReminderRepo;
  systemSettings: SystemSettingRepo;
  councils: CouncilRepo;
  assignments: AssignmentRepo;
  scoreSheets: ScoreSheetRepo;
  advisoryReports: AdvisoryReportRepo;
  meetings: MeetingRepo;
  aggregateResults: AggregateResultRepo;
  templateVersions: TemplateVersionRepo;
  recognitionDecisions: RecognitionDecisionRepo;
  certificates: CertificateRepo;
}

/** Everything a use case can touch inside one database transaction. */
export interface Tx extends Repos {
  /**
   * Registers an undo for a side effect outside the database (e.g. an object put to storage) that only
   * makes sense if the transaction commits. It runs, best effort, after a rollback; never after a commit.
   */
  onRollback(undo: () => Promise<void>): void;
}

export interface UnitOfWork {
  /** Runs `fn` in one transaction: commits when it resolves, rolls back when it throws. */
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}
