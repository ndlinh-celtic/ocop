import type { DraftNodeKind } from "./draft-events";
import { byPosition } from "./helpers";
import type { DraftNodeRows, SetRows, VersionRows } from "./version";

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

const inSequence = (items: SequenceItem[]) => items.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));

const setRowsOf = (rows: VersionRows, setId: string) => rows.sets.find((s) => s.set.id === setId);

/**
 * The nodes that share the `position` sequence of `row` (a node of kind `kind`, stored or about to be), in
 * order. Nhóm tiêu chí and the Tiêu chí placed directly in a Mục share one sequence per Mục.
 */
export function siblingsOf<K extends DraftNodeKind>(rows: VersionRows, kind: K, row: DraftNodeRows[K]): SequenceItem[] {
  const r = row as DraftNodeRows[DraftNodeKind];
  switch (kind) {
    case "productGroup":
      return inSequence(rows.productGroups.map(item("productGroup")));
    case "subgroup": {
      const parent = (r as DraftNodeRows["subgroup"]).productGroupId;
      return inSequence(rows.subgroups.filter((s) => s.productGroupId === parent).map(item("subgroup")));
    }
    case "set": {
      const parent = (r as DraftNodeRows["set"]).subgroupId;
      return inSequence(rows.sets.filter((s) => s.set.subgroupId === parent).map((s) => item("set")(s.set)));
    }
  }
  const set = setRowsOf(rows, (r as { setId: string }).setId);
  if (!set) return [];
  switch (kind) {
    case "exclusion":
      return inSequence(set.exclusions.map(item("exclusion")));
    case "part":
      return inSequence(set.parts.map(item("part")));
    case "section": {
      const parent = (r as DraftNodeRows["section"]).partId;
      return inSequence(set.sections.filter((s) => s.partId === parent).map(item("section")));
    }
    case "scoreLevel": {
      const parent = (r as DraftNodeRows["scoreLevel"]).criterionId;
      return inSequence(set.levels.filter((l) => l.criterionId === parent).map(item("scoreLevel")));
    }
  }
  const groupId = kind === "criterion" ? (r as DraftNodeRows["criterion"]).groupId : null;
  if (groupId !== null) return inSequence(set.criteria.filter((c) => c.groupId === groupId).map(item("criterion")));
  const sectionId = (r as { sectionId: string }).sectionId;
  return inSequence([
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

/*
 * The rows of a version after one structure change, computed in memory so a use case that already loaded the
 * tree does not load it again to re-run the check. Each mirrors a repo write (insertNode, setPositions,
 * deleteNode with its cascade) and keeps the order loadRows returns: by position.
 */

/** The array of each kind of node inside one Bộ tiêu chí's rows. */
const SET_KEY = {
  exclusion: "exclusions",
  part: "parts",
  section: "sections",
  criterionGroup: "criterionGroups",
  criterion: "criteria",
  scoreLevel: "levels",
} as const satisfies Partial<Record<DraftNodeKind, keyof SetRows>>;

type Positioned = { id: string; position: number };

/** The rows with the list of `kind` replaced by `edit(list)`; for kinds inside a Bộ tiêu chí, only in the set `setId` when given. */
function editKind(rows: VersionRows, kind: DraftNodeKind, edit: <T extends Positioned>(list: readonly T[]) => T[], setId?: string): VersionRows {
  switch (kind) {
    case "productGroup":
      return { ...rows, productGroups: edit(rows.productGroups) };
    case "subgroup":
      return { ...rows, subgroups: edit(rows.subgroups) };
    case "set": {
      const below = new Map(rows.sets.map((s) => [s.set.id, s]));
      const none = { exclusions: [], parts: [], sections: [], criterionGroups: [], criteria: [], levels: [] };
      return { ...rows, sets: edit(rows.sets.map((s) => s.set)).map((set) => ({ ...(below.get(set.id) ?? none), set })) };
    }
    default: {
      const key = SET_KEY[kind];
      return { ...rows, sets: rows.sets.map((s) => (setId === undefined || s.set.id === setId ? { ...s, [key]: edit(s[key] as readonly Positioned[]) } : s)) };
    }
  }
}

/** After insertNode: `row` (whose parent is in `rows`) joins its kind's list. */
export function withNode<K extends DraftNodeKind>(rows: VersionRows, kind: K, row: DraftNodeRows[K]): VersionRows {
  const setId = (row as { setId?: string }).setId;
  return editKind(rows, kind, <T extends Positioned>(list: readonly T[]) => byPosition([...list, row as unknown as T]), setId);
}

/** After setPositions: some nodes of one kind have a new `position`. */
export function withPositions(rows: VersionRows, kind: DraftNodeKind, positions: readonly Positioned[]): VersionRows {
  const next = new Map(positions.map((p) => [p.id, p.position]));
  return editKind(rows, kind, (list) =>
    list.some((r) => next.has(r.id)) ? byPosition(list.map((r) => (next.has(r.id) ? { ...r, position: next.get(r.id)! } : r))) : [...list],
  );
}

/** After deleteNode: the node is gone with everything below it (the foreign keys cascade). */
export function withoutNode(rows: VersionRows, kind: DraftNodeKind, id: string): VersionRows {
  const keep = (k: DraftNodeKind) => (r: { id: string }) => !(kind === k && r.id === id);
  const productGroups = rows.productGroups.filter(keep("productGroup"));
  const groupIds = new Set(productGroups.map((g) => g.id));
  const subgroups = rows.subgroups.filter((s) => groupIds.has(s.productGroupId) && keep("subgroup")(s));
  const subgroupIds = new Set(subgroups.map((s) => s.id));
  const sets = rows.sets
    .filter((s) => subgroupIds.has(s.set.subgroupId) && keep("set")(s.set))
    .map((s): SetRows => {
      const parts = s.parts.filter(keep("part"));
      const partIds = new Set(parts.map((p) => p.id));
      const sections = s.sections.filter((x) => partIds.has(x.partId) && keep("section")(x));
      const sectionIds = new Set(sections.map((x) => x.id));
      const criterionGroups = s.criterionGroups.filter((g) => sectionIds.has(g.sectionId) && keep("criterionGroup")(g));
      const criterionGroupIds = new Set(criterionGroups.map((g) => g.id));
      const criteria = s.criteria.filter((c) => sectionIds.has(c.sectionId) && (c.groupId === null || criterionGroupIds.has(c.groupId)) && keep("criterion")(c));
      const criterionIds = new Set(criteria.map((c) => c.id));
      const levels = s.levels.filter((l) => criterionIds.has(l.criterionId) && keep("scoreLevel")(l));
      return { set: s.set, exclusions: s.exclusions.filter(keep("exclusion")), parts, sections, criterionGroups, criteria, levels };
    });
  return { ...rows, productGroups, subgroups, sets };
}
