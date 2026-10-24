import type { AggregateResult, AggregateResultRepo, MeetingRepo } from "@ocop/core";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/types";
import { aggregateResult, meeting, meetingDossier, meetingMinutes, unlockRequest } from "../db/schema";

/** Phiên họp (#60): the DB keeps one pending row per hồ sơ and fixes the row of a hồ sơ chốt. */
export function meetingRepo(db: Db): MeetingRepo {
  return {
    async insert(m) {
      await db.insert(meeting).values(m);
    },
    async update({ id, councilId: _c, roundId: _r, createdBy: _b, createdAt: _a, ...fields }) {
      await db.update(meeting).set(fields).where(eq(meeting.id, id));
    },
    async findById(id) {
      const [row] = await db.select().from(meeting).where(eq(meeting.id, id));
      return row ?? null;
    },
    async lock(id) {
      const [row] = await db.select().from(meeting).where(eq(meeting.id, id)).for("update");
      return row ?? null;
    },
    async list(councilId, roundId) {
      return db
        .select()
        .from(meeting)
        .where(and(eq(meeting.councilId, councilId), roundId ? eq(meeting.roundId, roundId) : undefined))
        .orderBy(desc(meeting.heldOn), desc(meeting.createdAt), desc(meeting.id));
    },
    async dossiers(meetingId) {
      return db.select().from(meetingDossier).where(eq(meetingDossier.meetingId, meetingId)).orderBy(asc(meetingDossier.addedAt), asc(meetingDossier.dossierId));
    },
    async pendingOf(dossierId) {
      const [row] = await db
        .select()
        .from(meetingDossier)
        .where(and(eq(meetingDossier.dossierId, dossierId), isNull(meetingDossier.resultId)));
      return row ?? null;
    },
    async addDossier(row) {
      // A hồ sơ chốt here whose kết quả a Mở khóa superseded waits here again (migration 0044 lets the row go back).
      const inserted = await db
        .insert(meetingDossier)
        .values(row)
        .onConflictDoUpdate({
          target: [meetingDossier.meetingId, meetingDossier.dossierId],
          set: { resultId: null },
          setWhere: sql`${meetingDossier.resultId} IN (SELECT ${aggregateResult.id} FROM ${aggregateResult} WHERE ${aggregateResult.supersededAt} IS NOT NULL)`,
        })
        .returning({ id: meetingDossier.dossierId });
      return inserted.length === 1;
    },
    async removeDossier(meetingId, dossierId) {
      const rows = await db
        .delete(meetingDossier)
        .where(and(eq(meetingDossier.meetingId, meetingId), eq(meetingDossier.dossierId, dossierId), isNull(meetingDossier.resultId)))
        .returning({ id: meetingDossier.dossierId });
      return rows.length === 1;
    },
    async markFinalized(meetingId, dossierId, resultId) {
      await db
        .update(meetingDossier)
        .set({ resultId })
        .where(and(eq(meetingDossier.meetingId, meetingId), eq(meetingDossier.dossierId, dossierId), isNull(meetingDossier.resultId)));
    },
    async minutes(meetingId) {
      return db.select().from(meetingMinutes).where(eq(meetingMinutes.meetingId, meetingId)).orderBy(desc(meetingMinutes.number));
    },
    async insertMinutes(m) {
      const inserted = await db.insert(meetingMinutes).values(m).onConflictDoNothing({ target: meetingMinutes.fileId }).returning({ id: meetingMinutes.id });
      return inserted.length === 1;
    },
  };
}

/** Kết quả chốt (#60): insert only; the DB refuses any change but superseding it once. */
export function aggregateResultRepo(db: Db): AggregateResultRepo {
  return {
    async insert(r: AggregateResult) {
      await db.insert(aggregateResult).values(r);
    },
    async current(dossierId) {
      const [row] = await db
        .select()
        .from(aggregateResult)
        .where(and(eq(aggregateResult.dossierId, dossierId), isNull(aggregateResult.supersededAt)));
      return row ?? null;
    },
    async list(dossierId) {
      return db.select().from(aggregateResult).where(eq(aggregateResult.dossierId, dossierId)).orderBy(asc(aggregateResult.n));
    },
    async supersede(resultId, at, unlockId) {
      const rows = await db
        .update(aggregateResult)
        .set({ supersededAt: at, supersededByUnlock: unlockId })
        .where(and(eq(aggregateResult.id, resultId), isNull(aggregateResult.supersededAt)))
        .returning({ id: aggregateResult.id });
      return rows.length === 1;
    },
    async insertUnlock(u) {
      await db.insert(unlockRequest).values(u);
    },
    async unlocks(dossierId) {
      return db.select().from(unlockRequest).where(eq(unlockRequest.dossierId, dossierId)).orderBy(asc(unlockRequest.unlockedAt), asc(unlockRequest.id));
    },
  };
}
