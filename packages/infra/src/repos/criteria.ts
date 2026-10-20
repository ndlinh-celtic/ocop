import type { CriteriaVersion, CriteriaVersionRepo, SetRows, VersionStatus } from "@ocop/core";
import { asc, count, desc, eq, inArray } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Db } from "../db/types";
import {
  criteriaPart,
  criteriaSection,
  criteriaSet,
  criteriaVersion,
  criterion,
  criterionGroup,
  exclusionCondition,
  productGroup,
  productSubgroup,
  rankThreshold,
  scoreLevel,
} from "../db/schema";

/** Keeps each INSERT well under PostgreSQL's 65 535 bind parameters. */
const CHUNK = 500;

async function insertAll<T extends PgTable>(db: Db, table: T, rows: T["$inferInsert"][]) {
  for (let i = 0; i < rows.length; i += CHUNK) await db.insert(table).values(rows.slice(i, i + CHUNK));
}

const toVersion = (row: typeof criteriaVersion.$inferSelect): CriteriaVersion => ({ ...row, status: row.status as VersionStatus });

export function criteriaVersionRepo(db: Db): CriteriaVersionRepo {
  return {
    async insert(version, rows) {
      const versionId = version.id;
      await db.insert(criteriaVersion).values(version);
      await insertAll(
        db,
        rankThreshold,
        ([2, 3, 4, 5] as const).map((stars) => ({ versionId, stars, minScore: rows.thresholds[stars] })),
      );
      await insertAll(db, productGroup, rows.productGroups.map((r) => ({ ...r, versionId })));
      await insertAll(db, productSubgroup, rows.subgroups.map((r) => ({ ...r, versionId })));
      const withVersion = <T>(pick: (s: SetRows) => T[]) => rows.sets.flatMap((s) => pick(s).map((r) => ({ ...r, versionId })));
      await insertAll(db, criteriaSet, withVersion((s) => [s.set]));
      await insertAll(db, exclusionCondition, withVersion((s) => s.exclusions));
      await insertAll(db, criteriaPart, withVersion((s) => s.parts));
      await insertAll(db, criteriaSection, withVersion((s) => s.sections));
      await insertAll(db, criterionGroup, withVersion((s) => s.criterionGroups));
      await insertAll(db, criterion, withVersion((s) => s.criteria));
      await insertAll(db, scoreLevel, withVersion((s) => s.levels));
    },

    async findById(id) {
      const [row] = await db.select().from(criteriaVersion).where(eq(criteriaVersion.id, id));
      return row ? toVersion(row) : null;
    },

    async list(filter) {
      const setCounts = db
        .select({ versionId: criteriaSet.versionId, n: count().as("n") })
        .from(criteriaSet)
        .groupBy(criteriaSet.versionId)
        .as("set_counts");
      const query = db.select({ v: criteriaVersion, n: setCounts.n }).from(criteriaVersion).leftJoin(setCounts, eq(setCounts.versionId, criteriaVersion.id));
      const rows = await (filter.status ? query.where(eq(criteriaVersion.status, filter.status)) : query).orderBy(desc(criteriaVersion.createdAt), desc(criteriaVersion.id));
      return rows.map((r) => ({ ...toVersion(r.v), setCount: Number(r.n ?? 0) }));
    },

    async taxonomy(versionId) {
      const thresholds = await db.select().from(rankThreshold).where(eq(rankThreshold.versionId, versionId));
      const groups = await db.select().from(productGroup).where(eq(productGroup.versionId, versionId)).orderBy(asc(productGroup.position));
      const subgroups = await db.select().from(productSubgroup).where(eq(productSubgroup.versionId, versionId)).orderBy(asc(productSubgroup.position));
      const sets = await db.select().from(criteriaSet).where(eq(criteriaSet.versionId, versionId)).orderBy(asc(criteriaSet.position));
      const counts = sets.length
        ? await db
            .select({ setId: criterion.setId, n: count() })
            .from(criterion)
            .where(inArray(criterion.setId, sets.map((s) => s.id)))
            .groupBy(criterion.setId)
        : [];
      const countOf = new Map(counts.map((c) => [c.setId, Number(c.n)]));
      const min = (stars: 2 | 3 | 4 | 5) => thresholds.find((t) => t.stars === stars)?.minScore ?? 0;
      return {
        thresholds: { 2: min(2), 3: min(3), 4: min(4), 5: min(5) },
        productGroups: groups.map(({ versionId: _, ...g }) => g),
        subgroups: subgroups.map(({ versionId: _, ...s }) => s),
        sets: sets.map(({ versionId: _, ...s }) => ({ ...s, criterionCount: countOf.get(s.id) ?? 0 })),
      };
    },

    async lock(id) {
      const [row] = await db.select().from(criteriaVersion).where(eq(criteriaVersion.id, id)).for("update");
      return row ? toVersion(row) : null;
    },

    async loadRows(versionId) {
      const t = await this.taxonomy(versionId);
      const exclusions = await db.select().from(exclusionCondition).where(eq(exclusionCondition.versionId, versionId)).orderBy(asc(exclusionCondition.position));
      const parts = await db.select().from(criteriaPart).where(eq(criteriaPart.versionId, versionId)).orderBy(asc(criteriaPart.position));
      const sections = await db.select().from(criteriaSection).where(eq(criteriaSection.versionId, versionId)).orderBy(asc(criteriaSection.position));
      const groups = await db.select().from(criterionGroup).where(eq(criterionGroup.versionId, versionId)).orderBy(asc(criterionGroup.position));
      const criteria = await db.select().from(criterion).where(eq(criterion.versionId, versionId)).orderBy(asc(criterion.position));
      const levels = await db.select().from(scoreLevel).where(eq(scoreLevel.versionId, versionId)).orderBy(asc(scoreLevel.position));
      const ofSet = <R extends { setId: string; versionId: string }>(rows: R[], setId: string) =>
        rows.filter((r) => r.setId === setId).map(({ versionId: _, ...r }) => r);
      return {
        thresholds: t.thresholds,
        productGroups: t.productGroups,
        subgroups: t.subgroups,
        sets: t.sets.map(({ criterionCount: _, ...set }) => ({
          set,
          exclusions: ofSet(exclusions, set.id),
          parts: ofSet(parts, set.id),
          sections: ofSet(sections, set.id),
          criterionGroups: ofSet(groups, set.id),
          criteria: ofSet(criteria, set.id),
          levels: ofSet(levels, set.id),
        })),
      };
    },

    async markPublished(id, at, by) {
      await db.update(criteriaVersion).set({ status: "published", publishedAt: at, publishedBy: by }).where(eq(criteriaVersion.id, id));
    },

    async findSet(setId) {
      const [set] = await db.select().from(criteriaSet).where(eq(criteriaSet.id, setId));
      if (!set) return null;
      const { versionId, ...setRow } = set;
      const strip = <T extends { versionId: string }>(rows: T[]) => rows.map(({ versionId: _, ...r }) => r);
      const exclusions = await db.select().from(exclusionCondition).where(eq(exclusionCondition.setId, setId)).orderBy(asc(exclusionCondition.position));
      const parts = await db.select().from(criteriaPart).where(eq(criteriaPart.setId, setId)).orderBy(asc(criteriaPart.position));
      const sections = await db.select().from(criteriaSection).where(eq(criteriaSection.setId, setId)).orderBy(asc(criteriaSection.position));
      const groups = await db.select().from(criterionGroup).where(eq(criterionGroup.setId, setId)).orderBy(asc(criterionGroup.position));
      const criteria = await db.select().from(criterion).where(eq(criterion.setId, setId)).orderBy(asc(criterion.position));
      const levels = await db.select().from(scoreLevel).where(eq(scoreLevel.setId, setId)).orderBy(asc(scoreLevel.position));
      return {
        versionId,
        rows: {
          set: setRow,
          exclusions: strip(exclusions),
          parts: strip(parts),
          sections: strip(sections),
          criterionGroups: strip(groups),
          criteria: strip(criteria),
          levels: strip(levels),
        },
      };
    },
  };
}
