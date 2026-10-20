import type { DataScope, Entity, EntityRepo, LegalDocumentRecord, LegalDocumentRepo } from "@ocop/core";
import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/types";
import { entity, file, legalDocument, legalDocumentType } from "../db/schema";

/**
 * The reader's DataScope as a WHERE clause: rows outside it are never loaded (#14). The switch is
 * exhaustive, so a new DataScope branch does not compile until this repository decides what it sees.
 */
function inScope(scope: DataScope): SQL {
  switch (scope.kind) {
    case "entity":
      return eq(entity.id, scope.entityId);
    case "none":
      return sql`false`;
    default: {
      const unhandled: never = scope;
      throw new Error(`unhandled data scope ${JSON.stringify(unhandled)}`);
    }
  }
}

export function entityRepo(db: Db): EntityRepo {
  return {
    async insert(e) {
      const inserted = await db.insert(entity).values(e).onConflictDoNothing({ target: entity.identifierFingerprint }).returning({ id: entity.id });
      return inserted.length === 1;
    },
    async findById(scope, id) {
      const [row] = await db
        .select()
        .from(entity)
        .where(and(inScope(scope), eq(entity.id, id)));
      return (row as Entity | undefined) ?? null;
    },
    async lock(scope, id) {
      const [row] = await db
        .select()
        .from(entity)
        .where(and(inScope(scope), eq(entity.id, id)))
        .for("update");
      return (row as Entity | undefined) ?? null;
    },
    async update(e) {
      await db.update(entity).set(e).where(eq(entity.id, e.id));
    },
    async list(scope) {
      return (await db.select().from(entity).where(inScope(scope)).orderBy(asc(entity.name))) as Entity[];
    },
  };
}

export function legalDocumentRepo(db: Db): LegalDocumentRepo {
  return {
    async types() {
      return db
        .select({ code: legalDocumentType.code, name: legalDocumentType.name, requiredFor: legalDocumentType.requiredFor })
        .from(legalDocumentType)
        .orderBy(asc(legalDocumentType.sortOrder));
    },
    async insert(d) {
      const inserted = await db.insert(legalDocument).values(d).onConflictDoNothing({ target: legalDocument.fileId }).returning({ id: legalDocument.id });
      return inserted.length === 1;
    },
    async markReplaced(id, replacedBy, at) {
      await db
        .update(legalDocument)
        .set({ replacedBy, replacedAt: at })
        .where(and(eq(legalDocument.id, id), isNull(legalDocument.replacedBy)));
    },
    async list(scope, entityId) {
      const rows = await db
        .select({ doc: legalDocument, fileName: file.fileName, fileStatus: file.status })
        .from(legalDocument)
        .innerJoin(entity, eq(entity.id, legalDocument.entityId))
        .innerJoin(file, eq(file.id, legalDocument.fileId))
        .where(and(inScope(scope), eq(legalDocument.entityId, entityId)))
        .orderBy(asc(legalDocument.addedAt));
      return rows.map((r): LegalDocumentRecord => ({ ...r.doc, file: { fileName: r.fileName, status: r.fileStatus } }));
    },
  };
}
