import type { AdvisoryReportRepo } from "@ocop/core";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db/types";
import { advisoryReportDraft, advisoryReportLine, advisoryReportVersion } from "../db/schema";

/** Báo cáo Tổ tư vấn (#56): the shared nháp with its lines, and the issued phiên bản, which the DB keeps fixed. */
export function advisoryReportRepo(db: Db): AdvisoryReportRepo {
  return {
    async draft(dossierId) {
      const [row] = await db.select().from(advisoryReportDraft).where(eq(advisoryReportDraft.dossierId, dossierId));
      if (!row) return null;
      const lines = await db.select().from(advisoryReportLine).where(eq(advisoryReportLine.dossierId, dossierId));
      return { ...row, lines: lines.map(({ dossierId: _d, ...l }) => l) };
    },
    async saveDraft({ lines, ...draft }, expectedVersion) {
      if (expectedVersion === 0) {
        const inserted = await db.insert(advisoryReportDraft).values(draft).onConflictDoNothing().returning({ v: advisoryReportDraft.version });
        if (inserted.length === 0) return false;
      } else {
        const { dossierId, ...fields } = draft;
        const updated = await db
          .update(advisoryReportDraft)
          .set(fields)
          .where(and(eq(advisoryReportDraft.dossierId, dossierId), eq(advisoryReportDraft.version, expectedVersion)))
          .returning({ v: advisoryReportDraft.version });
        if (updated.length === 0) return false;
        await db.delete(advisoryReportLine).where(eq(advisoryReportLine.dossierId, dossierId));
      }
      if (lines.length > 0) await db.insert(advisoryReportLine).values(lines.map((l) => ({ ...l, dossierId: draft.dossierId })));
      return true;
    },
    async versions(dossierId) {
      return db.select().from(advisoryReportVersion).where(eq(advisoryReportVersion.dossierId, dossierId)).orderBy(asc(advisoryReportVersion.number));
    },
    async insertVersion(v) {
      await db.insert(advisoryReportVersion).values(v);
    },
  };
}
