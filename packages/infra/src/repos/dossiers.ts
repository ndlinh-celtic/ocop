import { FINISHED_STATES, type DataScope, type Dossier, type DossierEvent, type DossierRepo, type Submission } from "@ocop/core";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, max, notInArray, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/types";
import {
  checklistResult,
  criteriaSet,
  criterionEntry,
  dossier,
  dossierCodeCounter,
  dossierEvent,
  entity,
  evidenceFile,
  evidenceLink,
  file,
  productSubgroup,
  returnRequest,
  round,
  submission,
  submissionFile,
  wardReport,
} from "../db/schema";

/**
 * The reader's DataScope as a WHERE clause on hồ sơ (#14): rows outside it are never loaded, and a
 * deleted Nháp is outside every scope. The switch is exhaustive, so a new DataScope branch does not
 * compile until this repository decides what it sees.
 */
function inScope(scope: DataScope): SQL {
  const live = isNull(dossier.deletedAt);
  switch (scope.kind) {
    case "entity":
      return and(live, eq(dossier.entityId, scope.entityId))!;
    case "ward":
      // The xã the hồ sơ was submitted to (or moved to by Chuyển xã); a Nháp belongs to no xã yet.
      return and(live, eq(dossier.wardId, scope.wardId))!;
    case "province":
      // From the first gửi tỉnh on, even after the Sở trả về it (story 78).
      return and(live, isNotNull(dossier.firstForwardedAt))!;
    case "on_behalf":
      // Nhập hộ (story 75): the hồ sơ of the Chủ thể, only while it is đăng ký ở xã of the officer, and
      // only those with no xã yet (a Nháp) or at the officer's xã: one Chuyển xã elsewhere is out (story 49).
      return and(
        live,
        eq(dossier.entityId, scope.entityId),
        or(isNull(dossier.wardId), eq(dossier.wardId, scope.wardId)),
        sql`exists (select 1 from ${entity} where ${entity.id} = ${dossier.entityId} and ${entity.wardId} = ${scope.wardId})`,
      )!;
    case "none":
      return sql`false`;
    default: {
      const unhandled: never = scope;
      throw new Error(`unhandled data scope ${JSON.stringify(unhandled)}`);
    }
  }
}

export function dossierRepo(db: Db): DossierRepo {
  return {
    async insert(d) {
      await db.insert(dossier).values(d);
    },
    async nextCodeNumber(year) {
      const [row] = await db
        .insert(dossierCodeCounter)
        .values({ year, lastNumber: 1 })
        .onConflictDoUpdate({ target: dossierCodeCounter.year, set: { lastNumber: sql`${dossierCodeCounter.lastNumber} + 1` } })
        .returning({ n: dossierCodeCounter.lastNumber });
      return row!.n;
    },
    async findById(scope, id) {
      const [row] = await db
        .select()
        .from(dossier)
        .where(and(inScope(scope), eq(dossier.id, id)));
      return (row as Dossier | undefined) ?? null;
    },
    async lock(scope, id) {
      const [row] = await db
        .select()
        .from(dossier)
        .where(and(inScope(scope), eq(dossier.id, id)))
        .for("update");
      return (row as Dossier | undefined) ?? null;
    },
    async update(d, expectedVersion) {
      const { id: _id, code: _code, entityId: _e, criteriaSetId: _s, criteriaVersionId: _v, copiedFrom: _c, createdAt: _ca, createdBy: _cb, ...fields } = d;
      const updated = await db
        .update(dossier)
        .set(fields)
        .where(and(eq(dossier.id, d.id), eq(dossier.version, expectedVersion)))
        .returning({ id: dossier.id });
      return updated.length === 1;
    },
    async list(scope, filter = {}) {
      const where = and(
        inScope(scope),
        filter.state ? eq(dossier.state, filter.state) : undefined,
        filter.awaitingReceipt ? and(eq(dossier.state, "submitted_to_ward"), isNull(dossier.receivedAt)) : undefined,
        filter.handlerUserId ? eq(dossier.handlerUserId, filter.handlerUserId) : undefined,
        filter.awaitingProvinceReceipt ? and(eq(dossier.state, "forwarded_to_province"), isNull(dossier.provinceReceivedAt)) : undefined,
        filter.roundId ? eq(dossier.roundId, filter.roundId) : undefined,
        filter.wardId ? eq(dossier.wardId, filter.wardId) : undefined,
        filter.productGroupId
          ? inArray(
              dossier.criteriaSetId,
              db
                .select({ id: criteriaSet.id })
                .from(criteriaSet)
                .innerJoin(productSubgroup, eq(productSubgroup.id, criteriaSet.subgroupId))
                .where(eq(productSubgroup.productGroupId, filter.productGroupId)),
            )
          : undefined,
        filter.awaitingNextRoundAt
          ? and(
              eq(dossier.state, "submitted_to_ward"),
              inArray(dossier.roundId, db.select({ id: round.id }).from(round).where(lt(round.forwardingDeadline, filter.awaitingNextRoundAt))),
            )
          : undefined,
      );
      return (await db.select().from(dossier).where(where).orderBy(desc(dossier.createdAt), desc(dossier.id))) as Dossier[];
    },
    async countNotForwarded(filter = {}) {
      const rows = await db
        .select({ wardId: dossier.wardId, state: dossier.state, count: sql<number>`count(*)::int` })
        .from(dossier)
        .where(
          and(
            isNull(dossier.deletedAt),
            isNotNull(dossier.wardId),
            isNull(dossier.firstForwardedAt),
            filter.roundId ? eq(dossier.roundId, filter.roundId) : undefined,
          ),
        )
        .groupBy(dossier.wardId, dossier.state);
      return rows.map((r) => ({ wardId: r.wardId!, state: r.state, count: r.count }));
    },
    async countUnfinishedInRound(roundId) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(dossier)
        .where(and(isNull(dossier.deletedAt), eq(dossier.roundId, roundId), notInArray(dossier.state, [...FINISHED_STATES])));
      return row?.count ?? 0;
    },
    async appendEvent(e) {
      await db.insert(dossierEvent).values(e);
    },
    async events(scope, dossierId) {
      const rows = await db
        .select({ e: dossierEvent })
        .from(dossierEvent)
        .innerJoin(dossier, eq(dossier.id, dossierEvent.dossierId))
        .where(and(inScope(scope), eq(dossierEvent.dossierId, dossierId)))
        .orderBy(asc(dossierEvent.occurredAt), asc(dossierEvent.id));
      return rows.map((r) => r.e as DossierEvent);
    },
    async addEvidence(e) {
      const inserted = await db.insert(evidenceFile).values(e).onConflictDoNothing().returning({ fileId: evidenceFile.fileId });
      return inserted.length === 1;
    },
    async evidence(dossierId) {
      return db
        .select({ fileId: evidenceFile.fileId, fileName: file.fileName, status: file.status, addedAt: evidenceFile.addedAt })
        .from(evidenceFile)
        .innerJoin(file, eq(file.id, evidenceFile.fileId))
        .where(eq(evidenceFile.dossierId, dossierId))
        .orderBy(asc(evidenceFile.addedAt), asc(file.fileName));
    },
    async removeEvidence(dossierId, fileId) {
      // The ties to Tiêu chí go with it (ON DELETE CASCADE).
      const removed = await db
        .delete(evidenceFile)
        .where(and(eq(evidenceFile.dossierId, dossierId), eq(evidenceFile.fileId, fileId)))
        .returning({ fileId: evidenceFile.fileId });
      return removed.length === 1;
    },
    async setEvidenceLinks(dossierId, fileId, criterionIds) {
      await db.delete(evidenceLink).where(and(eq(evidenceLink.dossierId, dossierId), eq(evidenceLink.fileId, fileId)));
      if (criterionIds.length > 0) await db.insert(evidenceLink).values(criterionIds.map((criterionId) => ({ dossierId, fileId, criterionId })));
    },
    async evidenceLinks(dossierId) {
      return db
        .select({ fileId: evidenceLink.fileId, criterionId: evidenceLink.criterionId })
        .from(evidenceLink)
        .where(eq(evidenceLink.dossierId, dossierId));
    },
    async checklistResults(dossierId) {
      return db.select().from(checklistResult).where(eq(checklistResult.dossierId, dossierId));
    },
    async saveChecklistResult(r) {
      await db
        .insert(checklistResult)
        .values(r)
        .onConflictDoUpdate({
          target: [checklistResult.dossierId, checklistResult.itemCode],
          set: { result: r.result, comment: r.comment, assessedAt: r.assessedAt, assessedBy: r.assessedBy },
        });
    },
    async insertWardReport(r) {
      await db.insert(wardReport).values(r);
    },
    async latestWardReport(dossierId) {
      const [row] = await db
        .select({
          id: wardReport.id,
          dossierId: wardReport.dossierId,
          submissionNumber: wardReport.submissionNumber,
          fileId: wardReport.fileId,
          uploadedBy: wardReport.uploadedBy,
          uploadedAt: wardReport.uploadedAt,
          fileName: file.fileName,
          fileStatus: file.status,
        })
        .from(wardReport)
        .innerJoin(file, eq(file.id, wardReport.fileId))
        .where(eq(wardReport.dossierId, dossierId))
        .orderBy(desc(wardReport.uploadedAt), desc(wardReport.id))
        .limit(1);
      return row ?? null;
    },
    async insertReturnRequest(r) {
      await db.insert(returnRequest).values(r);
    },
    async returnRequests(dossierId) {
      return db.select().from(returnRequest).where(eq(returnRequest.dossierId, dossierId)).orderBy(asc(returnRequest.requestedAt), asc(returnRequest.id));
    },
    async criterionEntries(dossierId) {
      return db.select().from(criterionEntry).where(eq(criterionEntry.dossierId, dossierId));
    },
    async saveCriterionEntry(e) {
      await db
        .insert(criterionEntry)
        .values(e)
        .onConflictDoUpdate({
          target: [criterionEntry.dossierId, criterionEntry.criterionId],
          set: { scoreLevelId: e.scoreLevelId, explanation: e.explanation, updatedAt: e.updatedAt },
        });
    },
    async insertSubmission(s, files) {
      await db.insert(submission).values(s);
      if (files.length > 0) {
        await db
          .insert(submissionFile)
          .values(files.map((f) => ({ submissionId: s.id, fileId: f.fileId, role: f.role })))
          .onConflictDoNothing();
      }
    },
    async submissions(dossierId) {
      return (await db.select().from(submission).where(eq(submission.dossierId, dossierId)).orderBy(asc(submission.number))) as Submission[];
    },
    async lastSubmittedAt(dossierIds) {
      if (dossierIds.length === 0) return new Map();
      const rows = await db
        .select({ dossierId: submission.dossierId, at: max(submission.submittedAt) })
        .from(submission)
        .where(inArray(submission.dossierId, [...dossierIds]))
        .groupBy(submission.dossierId);
      return new Map(rows.flatMap((r) => (r.at ? [[r.dossierId, r.at] as const] : [])));
    },
    async latestSubmission(dossierId) {
      const [row] = await db.select().from(submission).where(eq(submission.dossierId, dossierId)).orderBy(desc(submission.number)).limit(1);
      return (row as Submission | undefined) ?? null;
    },
  };
}
