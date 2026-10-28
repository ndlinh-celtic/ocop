import type { FiveStarRepo } from "@ocop/core";
import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import type { Db } from "../db/types";
import { aggregateResult, dossier, fiveStarClosure, fiveStarDispatch } from "../db/schema";
import { currentResultOf } from "./meetings";

/** Đề xuất 5 sao (#87): the list reads the kết quả chốt hiện hành as stored; the DB keeps the records append-only. */
export function fiveStarRepo(db: Db): FiveStarRepo {
  return {
    async candidates(filter = {}) {
      const published5 = and(eq(dossier.state, "score_finalized"), isNotNull(dossier.resultPublishedAt), eq(aggregateResult.star, 5));
      const sent = and(
        eq(dossier.state, "five_star_proposed"),
        filter.awaiting === undefined ? undefined : eq(dossier.awaitingSupplementaryDecision, filter.awaiting),
      );
      return db
        .select({ dossierId: dossier.id, star: aggregateResult.star, total: aggregateResult.total })
        .from(dossier)
        .innerJoin(aggregateResult, currentResultOf(dossier.id))
        .where(and(isNull(dossier.deletedAt), filter.awaiting === undefined ? or(published5, sent) : sent));
    },
    async insertDispatch(d) {
      await db.insert(fiveStarDispatch).values(d);
    },
    async dispatchOf(dossierId) {
      const [row] = await db.select().from(fiveStarDispatch).where(eq(fiveStarDispatch.dossierId, dossierId));
      return row ?? null;
    },
    async insertClosure(c) {
      await db.insert(fiveStarClosure).values(c);
    },
    async closureOf(dossierId) {
      const [row] = await db.select().from(fiveStarClosure).where(eq(fiveStarClosure.dossierId, dossierId));
      return row ?? null;
    },
    async closures(outcome) {
      return db.select().from(fiveStarClosure).where(eq(fiveStarClosure.outcome, outcome)).orderBy(fiveStarClosure.decidedOn, fiveStarClosure.dossierId);
    },
  };
}
