import type { Tx } from "@ocop/core";
import type { Db } from "../db/types";
import { auditRepo } from "./audit";
import { auditChainRepo } from "./audit-chain";
import { fileRepo } from "./files";
import { oneTimeTokenRepo, roleAssignmentRepo, sessionRepo, userRepo } from "./identity";
import { notificationRepo } from "./notifications";
import { wardRepo } from "./org";
import { emailDeliveriesRepo, outboxRepo, processedEventsRepo } from "./platform";

export function buildRepos(db: Db): Tx {
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
  };
}
