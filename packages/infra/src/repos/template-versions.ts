import type { TemplateVersionRepo } from "@ocop/core";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/types";
import { documentTemplateVersion as v } from "../db/schema";

/** Phiên bản of the Mẫu văn bản (#82); the DB keeps one `active` per loại and refuses any other change. */
export function templateVersionRepo(db: Db): TemplateVersionRepo {
  return {
    async lockKind(kind) {
      await db.execute(sql`select pg_advisory_xact_lock(hashtext(${`document_template:${kind}`}))`);
    },
    async list(kind) {
      return db
        .select()
        .from(v)
        .where(kind ? eq(v.kind, kind) : undefined)
        .orderBy(v.kind, desc(v.n));
    },
    async findById(id) {
      const [row] = await db.select().from(v).where(eq(v.id, id));
      return row ?? null;
    },
    async active(kind) {
      const [row] = await db
        .select()
        .from(v)
        .where(and(eq(v.kind, kind), eq(v.active, true)));
      return row ?? null;
    },
    async insert(row) {
      await db.insert(v).values(row);
    },
    async setActive(kind, id) {
      // Two statements: the partial unique index on (kind) WHERE active is checked row by row.
      await db
        .update(v)
        .set({ active: false })
        .where(and(eq(v.kind, kind), eq(v.active, true)));
      if (id)
        await db
          .update(v)
          .set({ active: true })
          .where(and(eq(v.kind, kind), eq(v.id, id)));
    },
  };
}
