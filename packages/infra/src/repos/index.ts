import type { Tx } from "@ocop/core";
import type { Db } from "../db/types";
import { auditRepo } from "./audit";
import { oneTimeTokenRepo, roleAssignmentRepo, sessionRepo, userRepo } from "./identity";
import { emailDeliveriesRepo, outboxRepo, processedEventsRepo } from "./platform";

export function buildRepos(db: Db): Tx {
  return {
    users: userRepo(db),
    roleAssignments: roleAssignmentRepo(db),
    sessions: sessionRepo(db),
    oneTimeTokens: oneTimeTokenRepo(db),
    audit: auditRepo(db),
    outbox: outboxRepo(db),
    processedEvents: processedEventsRepo(db),
    emailDeliveries: emailDeliveriesRepo(db),
  };
}
