import type { DataScope, Entity, EntityRepo, LegalDocumentRecord, LegalDocumentRepo } from "@ocop/core";
import { and, asc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/types";
import { dossier, entity, file, legalDocument, legalDocumentType } from "../db/schema";
import { inScope as dossierInScopeSql } from "./dossiers";

/**
 * The reader's DataScope as a WHERE clause: rows outside it are never loaded (#14). The switch is
 * exhaustive, so a new DataScope branch does not compile until this repository decides what it sees.
 */
function inScope(scope: DataScope): SQL {
  switch (scope.kind) {
    case "entity":
      return eq(entity.id, scope.entityId);
    case "ward":
      // Story 77: the Chủ thể đăng ký ở xã mình, or with a hồ sơ now in the xã (submitted here, or moved
      // here by Chuyển xã); a Nháp belongs to no xã.
      return or(
        eq(entity.wardId, scope.wardId),
        sql`exists (select 1 from ${dossier} where ${dossier.entityId} = ${entity.id} and ${dossier.wardId} = ${scope.wardId} and ${dossier.deletedAt} is null)`,
      )!;
    case "province":
      // Story 78: a Chủ thể with at least one hồ sơ that has reached the province.
      return sql`exists (select 1 from ${dossier} where ${dossier.entityId} = ${entity.id} and ${dossier.firstForwardedAt} is not null and ${dossier.deletedAt} is null)`;
    case "on_behalf":
      // Nhập hộ (story 75): the one Chủ thể, only while it is đăng ký ở xã of the officer.
      return and(eq(entity.id, scope.entityId), eq(entity.wardId, scope.wardId))!;
    case "council":
    case "assigned":
      // A Chủ thể with a hồ sơ the Hội đồng reader sees (spec #49): the same rule as the hồ sơ repository.
      return sql`exists (select 1 from ${dossier} where ${dossier.entityId} = ${entity.id} and ${dossierInScopeSql(scope)})`;
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
