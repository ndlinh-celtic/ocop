import type { CriteriaSet, Criterion, CriterionGroup, Part, ScoreLevel, Section } from "./model";
import type { SetRows } from "./version";

/*
 * A stored Bộ tiêu chí: the domain shape of model.ts plus ids and review notes. It stays assignable to
 * CriteriaSet, so the star rank (rankStars) runs on it directly, e.g. for the preview.
 */

export interface StoredScoreLevel extends ScoreLevel {
  readonly id: string;
  readonly systemAdded: boolean;
}

export interface StoredCriterion extends Criterion {
  readonly id: string;
  readonly extractionNote: string;
  readonly levels: readonly StoredScoreLevel[];
}

export interface StoredCriterionGroup extends CriterionGroup {
  readonly id: string;
  readonly criteria: readonly StoredCriterion[];
}

export interface StoredSection extends Section {
  readonly id: string;
  readonly items: readonly (StoredCriterion | StoredCriterionGroup)[];
}

export interface StoredPart extends Part {
  readonly id: string;
  readonly sections: readonly StoredSection[];
}

export interface ExclusionCondition {
  readonly id: string;
  readonly description: string;
}

export interface CriteriaSetDetail extends CriteriaSet {
  readonly id: string;
  readonly headerNote: string;
  readonly footerNote: string;
  readonly extractionNote: string;
  readonly sourcePages: readonly number[];
  readonly exclusionConditions: readonly ExclusionCondition[];
  readonly parts: readonly StoredPart[];
}

const byPosition = <T extends { position: number }>(rows: readonly T[]) => [...rows].sort((a, b) => a.position - b.position);

function groupBy<T, K>(rows: readonly T[], key: (r: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
  return map;
}

/** Builds the nested Bộ tiêu chí from its flat rows, every level in `position` order. */
export function assembleSet(rows: SetRows): CriteriaSetDetail {
  const levelsOf = groupBy(byPosition(rows.levels), (l) => l.criterionId);
  const criterion = (c: SetRows["criteria"][number]): StoredCriterion => ({
    kind: "criterion",
    id: c.id,
    code: c.code,
    name: c.name,
    requirement: c.requirement,
    maxPoints: c.maxPoints,
    note: c.note,
    extractionNote: c.extractionNote,
    levels: (levelsOf.get(c.id) ?? []).map((l) => ({
      id: l.id,
      description: l.description,
      points: l.points,
      minimumStar: l.minimumStar,
      branch: l.branch,
      systemAdded: l.systemAdded,
    })),
  });
  const criteriaOfGroup = groupBy(byPosition(rows.criteria.filter((c) => c.groupId !== null)), (c) => c.groupId);
  const sectionItems = (sectionId: string) =>
    [
      ...rows.criterionGroups
        .filter((g) => g.sectionId === sectionId)
        .map((g) => ({
          position: g.position,
          item: {
            kind: "group",
            id: g.id,
            code: g.code,
            name: g.name,
            points: g.points,
            criteria: (criteriaOfGroup.get(g.id) ?? []).map(criterion),
          } satisfies StoredCriterionGroup as StoredCriterionGroup | StoredCriterion,
        })),
      ...rows.criteria.filter((c) => c.sectionId === sectionId && c.groupId === null).map((c) => ({ position: c.position, item: criterion(c) })),
    ]
      .sort((a, b) => a.position - b.position)
      .map((x) => x.item);
  const sectionsOf = groupBy(byPosition(rows.sections), (s) => s.partId);
  return {
    id: rows.set.id,
    code: rows.set.code,
    name: rows.set.name,
    totalPoints: rows.set.totalPoints,
    headerNote: rows.set.headerNote,
    footerNote: rows.set.footerNote,
    extractionNote: rows.set.extractionNote,
    sourcePages: rows.set.sourcePages,
    exclusionConditions: byPosition(rows.exclusions).map((e) => ({ id: e.id, description: e.description })),
    parts: byPosition(rows.parts).map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      points: p.points,
      sections: (sectionsOf.get(p.id) ?? []).map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        points: s.points,
        items: sectionItems(s.id),
      })),
    })),
  };
}
