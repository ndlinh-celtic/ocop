import type { DataScope, Entity, EntityRepo } from "@ocop/core";
import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/types";
import { entity } from "../db/schema";

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
    async list(scope) {
      return (await db.select().from(entity).where(inScope(scope)).orderBy(asc(entity.name))) as Entity[];
    },
  };
}
