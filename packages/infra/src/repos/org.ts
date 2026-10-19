import type { Ward, WardRepo } from "@ocop/core";
import { eq } from "drizzle-orm";
import type { Db } from "../db/types";
import { ward } from "../db/schema";

export function wardRepo(db: Db): WardRepo {
  return {
    async findById(id) {
      const [row] = await db.select().from(ward).where(eq(ward.id, id));
      return (row as Ward | undefined) ?? null;
    },
    async list() {
      return (await db.select().from(ward).orderBy(ward.code)) as Ward[];
    },
  };
}
