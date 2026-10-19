import type { AuditLog } from "../audit/audit";
import type { RoleAssignmentRepo, SessionRepo, UserRepo } from "../identity/repos";

/** Everything a use case can touch inside one database transaction. */
export interface Tx {
  users: UserRepo;
  roleAssignments: RoleAssignmentRepo;
  sessions: SessionRepo;
  audit: AuditLog;
}

export interface UnitOfWork {
  /** Runs `fn` in one transaction: commits when it resolves, rolls back when it throws. */
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}
