import type { FileRepo, StoredFile } from "@ocop/core";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/types";
import { file } from "../db/schema";

export function fileRepo(db: Db): FileRepo {
  return {
    async insert(f) {
      await db.insert(file).values(f);
    },
    async findById(id) {
      const [row] = await db.select().from(file).where(eq(file.id, id));
      return (row as StoredFile | undefined) ?? null;
    },
    async update(id, patch) {
      await db.update(file).set(patch).where(eq(file.id, id));
    },
    async listByOwner(userId, limit) {
      return (await db.select().from(file).where(eq(file.ownerUserId, userId)).orderBy(desc(file.createdAt)).limit(limit)) as StoredFile[];
    },
  };
}
