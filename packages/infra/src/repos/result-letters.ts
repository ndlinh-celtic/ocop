import type { ResultLetterRepo } from "@ocop/core";
import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/types";
import { resultLetter as l } from "../db/schema";

/** Thư kết quả không đạt (#85): the DB keeps one letter per (hồ sơ, n) and refuses changing or removing one. */
export function resultLetterRepo(db: Db): ResultLetterRepo {
  return {
    async insert(letter) {
      const inserted = await db
        .insert(l)
        .values(letter)
        .onConflictDoNothing({ target: [l.dossierId, l.n] })
        .returning({ id: l.id });
      return inserted.length === 1;
    },
    async list(dossierId) {
      return db.select().from(l).where(eq(l.dossierId, dossierId)).orderBy(asc(l.n));
    },
  };
}
