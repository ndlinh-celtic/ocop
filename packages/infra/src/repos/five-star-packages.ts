import type { FiveStarPackageRepo } from "@ocop/core";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/types";
import { fiveStarPackage } from "../db/schema";

/** Gói đề nghị 5 sao (#89): a trigger lets a row move only once, from pending. */
export function fiveStarPackageRepo(db: Db): FiveStarPackageRepo {
  const pending = (id: string) => and(eq(fiveStarPackage.id, id), eq(fiveStarPackage.state, "pending"));
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
  };
}
