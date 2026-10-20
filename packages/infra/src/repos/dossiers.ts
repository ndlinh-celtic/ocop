import type { DataScope, Dossier, DossierEvent, DossierRepo } from "@ocop/core";
import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/types";
import { dossier, dossierEvent, evidenceFile, file } from "../db/schema";

/**
 * The reader's DataScope as a WHERE clause on hồ sơ (#14): rows outside it are never loaded, and a
 * deleted Nháp is outside every scope. The switch is exhaustive, so a new DataScope branch does not
 * compile until this repository decides what it sees.
 */
function inScope(scope: DataScope): SQL {
  const live = isNull(dossier.deletedAt);
  switch (scope.kind) {
    case "entity":
      return and(live, eq(dossier.entityId, scope.entityId))!;
    case "ward":
      // The xã the hồ sơ was submitted to (or moved to by Chuyển xã); a Nháp belongs to no xã yet.
      return and(live, eq(dossier.wardId, scope.wardId))!;
    case "none":
      return sql`false`;
    default: {
      const unhandled: never = scope;
      throw new Error(`unhandled data scope ${JSON.stringify(unhandled)}`);
    }
  }
}

export function dossierRepo(db: Db): DossierRepo {
  return {
    async insert(d) {
      await db.insert(dossier).values(d);
    },
    async findById(scope, id) {
      const [row] = await db
        .select()
        .from(dossier)
        .where(and(inScope(scope), eq(dossier.id, id)));
      return (row as Dossier | undefined) ?? null;
    },
    async lock(scope, id) {
      const [row] = await db
        .select()
        .from(dossier)
        .where(and(inScope(scope), eq(dossier.id, id)))
        .for("update");
      return (row as Dossier | undefined) ?? null;
    },
    async update(d, expectedVersion) {
      const { id: _id, entityId: _e, criteriaSetId: _s, criteriaVersionId: _v, copiedFrom: _c, createdAt: _ca, createdBy: _cb, ...fields } = d;
      const updated = await db
        .update(dossier)
        .set(fields)
        .where(and(eq(dossier.id, d.id), eq(dossier.version, expectedVersion)))
        .returning({ id: dossier.id });
      return updated.length === 1;
    },
    async list(scope) {
      return (await db.select().from(dossier).where(inScope(scope)).orderBy(desc(dossier.createdAt), desc(dossier.id))) as Dossier[];
    },
    async appendEvent(e) {
      await db.insert(dossierEvent).values(e);
    },
    async events(scope, dossierId) {
      const rows = await db
        .select({ e: dossierEvent })
        .from(dossierEvent)
        .innerJoin(dossier, eq(dossier.id, dossierEvent.dossierId))
        .where(and(inScope(scope), eq(dossierEvent.dossierId, dossierId)))
        .orderBy(asc(dossierEvent.occurredAt), asc(dossierEvent.id));
      return rows.map((r) => r.e as DossierEvent);
    },
    async addEvidence(e) {
      const inserted = await db.insert(evidenceFile).values(e).onConflictDoNothing().returning({ fileId: evidenceFile.fileId });
      return inserted.length === 1;
    },
    async evidence(dossierId) {
      return db
        .select({ fileId: evidenceFile.fileId, fileName: file.fileName, status: file.status, addedAt: evidenceFile.addedAt })
        .from(evidenceFile)
        .innerJoin(file, eq(file.id, evidenceFile.fileId))
        .where(eq(evidenceFile.dossierId, dossierId))
        .orderBy(asc(evidenceFile.addedAt), asc(file.fileName));
    },
  };
}
