import type { FileRepo, StoredFile } from "@ocop/core";
import { and, desc, eq } from "drizzle-orm";
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
    async updateIfStatus(id, expected, patch) {
      const rows = await db.update(file).set(patch).where(and(eq(file.id, id), eq(file.status, expected))).returning({ id: file.id });
      return rows.length === 1;
    },
    async listByOwner(userId, limit) {
      return (await db.select().from(file).where(eq(file.ownerUserId, userId)).orderBy(desc(file.createdAt)).limit(limit)) as StoredFile[];
    },
  };
}
