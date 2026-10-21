import type { CouncilRepo } from "@ocop/core";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/types";
import { council } from "../db/schema";

export function councilRepo(db: Db): CouncilRepo {
  return {
    async insert(c) {
      await db.insert(council).values(c);
    },
    async update({ id, createdAt: _a, createdBy: _b, ...fields }) {
      await db.update(council).set(fields).where(eq(council.id, id));
    },
    async findById(id) {
      const [row] = await db.select().from(council).where(eq(council.id, id));
      return row ?? null;
    },
    async lock(id) {
      const [row] = await db.select().from(council).where(eq(council.id, id)).for("update");
      return row ?? null;
    },
    async list() {
      return db.select().from(council).orderBy(desc(council.createdAt), desc(council.id));
    },
  };
}
