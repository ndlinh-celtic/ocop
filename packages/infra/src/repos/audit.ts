import type { AuditEntry, AuditLog } from "@ocop/core";
import { and, desc, eq, gte, inArray, lt, type SQL } from "drizzle-orm";
import type { Db } from "../db/types";
import { auditLog } from "../db/schema";

export function auditRepo(db: Db): AuditLog {
  return {
    async append(entry) {
      await db.insert(auditLog).values(entry);
    },
    async search(f) {
      const where: SQL[] = [];
      if (f.action?.length) where.push(inArray(auditLog.action, f.action));
      if (f.actorUserId) where.push(eq(auditLog.actorUserId, f.actorUserId));
      if (f.targetType) where.push(eq(auditLog.targetType, f.targetType));
      if (f.targetId) where.push(eq(auditLog.targetId, f.targetId));
      if (f.from) where.push(gte(auditLog.occurredAt, f.from));
      if (f.to) where.push(lt(auditLog.occurredAt, f.to));
      const rows = await db
        .select()
        .from(auditLog)
        .where(and(...where))
        .orderBy(desc(auditLog.occurredAt), desc(auditLog.id))
        .limit(f.limit ?? 200);
      return rows as AuditEntry[];
    },
  };
}
