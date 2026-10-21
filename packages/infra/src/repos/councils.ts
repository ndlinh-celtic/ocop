import type { AssignmentRepo, CouncilRepo, ScoreSheetRepo } from "@ocop/core";
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "../db/types";
import { assignment, council, dossier, scoreSheet, scoreSheetLine, scoreSheetLineFile } from "../db/schema";

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
    async markReplaced(id, at, by, reason) {
      const rows = await db
        .update(assignment)
        .set({ replacedAt: at, replacedBy: by, replaceReason: reason })
        .where(and(eq(assignment.id, id), isNull(assignment.replacedAt), isNotNull(assignment.effectiveAt)))
        .returning({ id: assignment.id });
      return rows.length === 1;
    },
    async replaced(dossierId) {
      return db
        .select()
        .from(assignment)
        .where(and(eq(assignment.dossierId, dossierId), isNotNull(assignment.replacedAt)))
        .orderBy(asc(assignment.replacedAt), asc(assignment.id));
    },
  };
}

export function scoreSheetRepo(db: Db): ScoreSheetRepo {
  return {
    async insert(s) {
      await db.insert(scoreSheet).values(s);
    },
    async update({ id, dossierId: _d, assignmentId: _a, attempt: _n, createdAt: _c, ...fields }, expectedVersion) {
      const rows = await db
        .update(scoreSheet)
        .set(fields)
        .where(and(eq(scoreSheet.id, id), eq(scoreSheet.version, expectedVersion), eq(scoreSheet.state, "draft")))
        .returning({ id: scoreSheet.id });
      return rows.length === 1;
    },
    async lines(scoreSheetId) {
      const lines = await db.select().from(scoreSheetLine).where(eq(scoreSheetLine.scoreSheetId, scoreSheetId));
      const files = await db.select().from(scoreSheetLineFile).where(eq(scoreSheetLineFile.scoreSheetId, scoreSheetId)).orderBy(asc(scoreSheetLineFile.fileId));
      return lines.map((l) => ({ ...l, fileIds: files.filter((f) => f.criterionId === l.criterionId).map((f) => f.fileId) }));
    },
    async saveLine({ fileIds, ...line }) {
      const { scoreSheetId: _s, criterionId: _c, ...fields } = line;
      await db.insert(scoreSheetLine).values(line).onConflictDoUpdate({ target: [scoreSheetLine.scoreSheetId, scoreSheetLine.criterionId], set: fields });
      await db.delete(scoreSheetLineFile).where(and(eq(scoreSheetLineFile.scoreSheetId, line.scoreSheetId), eq(scoreSheetLineFile.criterionId, line.criterionId)));
      if (fileIds.length > 0) {
        await db.insert(scoreSheetLineFile).values(fileIds.map((fileId) => ({ scoreSheetId: line.scoreSheetId, criterionId: line.criterionId, fileId })));
      }
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
