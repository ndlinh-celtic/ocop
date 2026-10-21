import type { AssignmentRepo, CouncilRepo, ScoreSheetRepo } from "@ocop/core";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "../db/types";
import { assignment, council, dossier, scoreSheet } from "../db/schema";

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

export function assignmentRepo(db: Db): AssignmentRepo {
  return {
    async current(dossierId) {
      return db
        .select()
        .from(assignment)
        .where(and(eq(assignment.dossierId, dossierId), isNull(assignment.replacedAt)))
        .orderBy(asc(assignment.createdAt), asc(assignment.id));
    },
    async insert(a) {
      await db.insert(assignment).values(a);
    },
    async deleteDrafts(ids) {
      if (ids.length === 0) return;
      await db.delete(assignment).where(and(inArray(assignment.id, [...ids]), isNull(assignment.effectiveAt)));
    },
    async takeEffect(dossierId, at) {
      const rows = await db
        .update(assignment)
        .set({ effectiveAt: at })
        .where(and(eq(assignment.dossierId, dossierId), isNull(assignment.effectiveAt), isNull(assignment.replacedAt)))
        .returning({ id: assignment.id });
      return rows.map((r) => r.id);
    },
  };
}

export function scoreSheetRepo(db: Db): ScoreSheetRepo {
  return {
    async insert(s) {
      await db.insert(scoreSheet).values(s);
    },
    async current(dossierId) {
      return db
        .select()
        .from(scoreSheet)
        .where(and(eq(scoreSheet.dossierId, dossierId), ne(scoreSheet.state, "superseded")))
        .orderBy(asc(scoreSheet.createdAt), asc(scoreSheet.id));
    },
    async existsInRound(roundId) {
      const [row] = await db
        .select({ one: sql<number>`1` })
        .from(scoreSheet)
        .innerJoin(dossier, eq(dossier.id, scoreSheet.dossierId))
        .where(eq(dossier.roundId, roundId))
        .limit(1);
      return row !== undefined;
    },
  };
}
