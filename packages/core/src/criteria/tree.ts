import type { DraftNodeKind } from "./draft-events";
import type { DraftNodeRows, VersionRows } from "./version";

/*
 * Where a node sits in the flat rows of a version (version.ts `VersionRows`): which nodes share its
 * `position` sequence, and which nodes go with it when it is removed. Pure, for the structure use cases (#23).
 */

/** One member of a `position` sequence. */
export interface SequenceItem {
  kind: DraftNodeKind;
  id: string;
  position: number;
}

const item =
  <K extends DraftNodeKind>(kind: K) =>
  (r: { id: string; position: number }): SequenceItem => ({ kind, id: r.id, position: r.position });

const byPosition = (items: SequenceItem[]) => items.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));

const setRowsOf = (rows: VersionRows, setId: string) => rows.sets.find((s) => s.set.id === setId);

/**
 * The nodes that share the `position` sequence of `row` (a node of kind `kind`, stored or about to be), in
 * order. Nhóm tiêu chí and the Tiêu chí placed directly in a Mục share one sequence per Mục.
 */
export function siblingsOf<K extends DraftNodeKind>(rows: VersionRows, kind: K, row: DraftNodeRows[K]): SequenceItem[] {
  const r = row as DraftNodeRows[DraftNodeKind];
  switch (kind) {
    case "productGroup":
      return byPosition(rows.productGroups.map(item("productGroup")));
    case "subgroup": {
      const parent = (r as DraftNodeRows["subgroup"]).productGroupId;
      return byPosition(rows.subgroups.filter((s) => s.productGroupId === parent).map(item("subgroup")));
    }
    case "set": {
      const parent = (r as DraftNodeRows["set"]).subgroupId;
      return byPosition(rows.sets.filter((s) => s.set.subgroupId === parent).map((s) => item("set")(s.set)));
    }
  }
  const set = setRowsOf(rows, (r as { setId: string }).setId);
  if (!set) return [];
  switch (kind) {
    case "exclusion":
      return byPosition(set.exclusions.map(item("exclusion")));
    case "part":
      return byPosition(set.parts.map(item("part")));
    case "section": {
      const parent = (r as DraftNodeRows["section"]).partId;
      return byPosition(set.sections.filter((s) => s.partId === parent).map(item("section")));
    }
    case "scoreLevel": {
      const parent = (r as DraftNodeRows["scoreLevel"]).criterionId;
      return byPosition(set.levels.filter((l) => l.criterionId === parent).map(item("scoreLevel")));
    }
  }
  const groupId = kind === "criterion" ? (r as DraftNodeRows["criterion"]).groupId : null;
  if (groupId !== null) return byPosition(set.criteria.filter((c) => c.groupId === groupId).map(item("criterion")));
  const sectionId = (r as { sectionId: string }).sectionId;
  return byPosition([
    ...set.criterionGroups.filter((g) => g.sectionId === sectionId).map(item("criterionGroup")),
    ...set.criteria.filter((c) => c.sectionId === sectionId && c.groupId === null).map(item("criterion")),
  ]);
}

/** The position for a node added at the end of `siblings`. */
export const nextPosition = (siblings: readonly SequenceItem[]) => siblings.reduce((max, s) => Math.max(max, s.position + 1), 0);

/** How many nodes of each kind go with a node when it is removed (its children, theirs, and so on). */
export function descendantsOf(rows: VersionRows, kind: DraftNodeKind, id: string): Partial<Record<DraftNodeKind, number>> {
  const counts: Partial<Record<DraftNodeKind, number>> = {};
  const add = (k: DraftNodeKind, n: number) => {
    if (n > 0) counts[k] = (counts[k] ?? 0) + n;
  };
  const subgroupIds = kind === "productGroup" ? rows.subgroups.filter((s) => s.productGroupId === id).map((s) => s.id) : kind === "subgroup" ? [id] : [];
  if (kind === "productGroup") add("subgroup", subgroupIds.length);
  for (const set of rows.sets) {
    const whole = kind === "set" ? set.set.id === id : subgroupIds.includes(set.set.subgroupId);
    if (whole) {
      if (kind !== "set") add("set", 1);
      add("exclusion", set.exclusions.length);
      add("part", set.parts.length);
      add("section", set.sections.length);
      add("criterionGroup", set.criterionGroups.length);
      add("criterion", set.criteria.length);
      add("scoreLevel", set.levels.length);
      continue;
    }
    const sectionIds = kind === "part" ? set.sections.filter((s) => s.partId === id).map((s) => s.id) : kind === "section" ? [id] : [];
    if (kind === "part") add("section", sectionIds.length);
    const groups = set.criterionGroups.filter((g) => sectionIds.includes(g.sectionId));
    add("criterionGroup", groups.length);
    const criteria = set.criteria.filter((c) =>
      kind === "criterionGroup" ? c.groupId === id : kind === "criterion" ? c.id === id : sectionIds.includes(c.sectionId),
    );
    if (kind !== "criterion") add("criterion", criteria.length);
    add("scoreLevel", set.levels.filter((l) => criteria.some((c) => c.id === l.criterionId)).length);
  }
  return counts;
}
