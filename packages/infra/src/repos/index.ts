import type { Tx } from "@ocop/core";
import type { PoolClient } from "pg";
import type { Db } from "../db/types";
import { auditRepo } from "./audit";
import { roleAssignmentRepo, sessionRepo, userRepo } from "./identity";

export function buildRepos(db: Db, _client: PoolClient): Tx {
  return {
    users: userRepo(db),
    roleAssignments: roleAssignmentRepo(db),
    sessions: sessionRepo(db),
    audit: auditRepo(db),
  };
}
