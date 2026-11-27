import type { FiveStarPackageRepo } from "@ocop/core";
import { and, asc, desc, eq, isNull, lte } from "drizzle-orm";
import type { Db } from "../db/types";
import { fiveStarPackage } from "../db/schema";

/** Gói đề nghị 5 sao (#89): a trigger lets a row move only once from pending, and a ready one be marked removed once. */
export function fiveStarPackageRepo(db: Db): FiveStarPackageRepo {
  const pending = (id: string) => and(eq(fiveStarPackage.id, id), eq(fiveStarPackage.state, "pending"));
  const notRemoved = and(eq(fiveStarPackage.state, "ready"), isNull(fiveStarPackage.removedAt));
  return {
    async insert(p) {
      await db.insert(fiveStarPackage).values(p);
    },
    async findById(id) {
      const [row] = await db.select().from(fiveStarPackage).where(eq(fiveStarPackage.id, id));
      return row ?? null;
    },
    async list(limit) {
      return db.select().from(fiveStarPackage).orderBy(desc(fiveStarPackage.requestedAt), desc(fiveStarPackage.id)).limit(limit);
    },
    async markReady(id, r) {
      const rows = await db
        .update(fiveStarPackage)
        .set({ state: "ready", ...r })
        .where(pending(id))
        .returning({ id: fiveStarPackage.id });
      return rows.length > 0;
    },
    async markFailed(id, f) {
      const rows = await db
        .update(fiveStarPackage)
        .set({ state: "failed", ...f })
        .where(pending(id))
        .returning({ id: fiveStarPackage.id });
      return rows.length > 0;
    },
    async dueForRemoval(now, limit) {
      return db
        .select()
        .from(fiveStarPackage)
        .where(and(notRemoved, lte(fiveStarPackage.expiresAt, now)))
        .orderBy(asc(fiveStarPackage.expiresAt), asc(fiveStarPackage.id))
        .limit(limit);
    },
    async markRemoved(id, removedAt) {
      const rows = await db
        .update(fiveStarPackage)
        .set({ removedAt })
        .where(and(eq(fiveStarPackage.id, id), notRemoved))
        .returning({ id: fiveStarPackage.id });
      return rows.length > 0;
    },
  };
}
