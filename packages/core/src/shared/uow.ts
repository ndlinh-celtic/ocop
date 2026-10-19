import type { AuditLog } from "../audit/audit";
import type { RoleAssignmentRepo, SessionRepo, UserRepo } from "../identity/repos";
import type { OneTimeTokenRepo } from "../identity/tokens";
import type { Outbox, ProcessedEvents } from "../platform/events";
import type { EmailDeliveries } from "../platform/mail";

/** Everything a use case can touch inside one database transaction. */
export interface Tx {
  users: UserRepo;
  roleAssignments: RoleAssignmentRepo;
  sessions: SessionRepo;
  oneTimeTokens: OneTimeTokenRepo;
  audit: AuditLog;
  outbox: Outbox;
  processedEvents: ProcessedEvents;
  emailDeliveries: EmailDeliveries;
}

export interface UnitOfWork {
  /** Runs `fn` in one transaction: commits when it resolves, rolls back when it throws. */
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}
