import { z } from "zod";
import { authorize } from "../identity/policy";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import type { Tx } from "../shared/uow";
import { changeDraft, findDraftNode, type DraftChangeResult } from "./draft-change";
import { DRAFT_NODE_KINDS, type DraftNodeKind } from "./draft-events";
import { branch, minimumStar, optionalText, parseOrRefuse, points, required } from "./edit";
import { SYSTEM_ZERO_LEVEL } from "./qd26-file";
import { descendantsOf, nextPosition, siblingsOf, withNode, withoutNode, withPositions } from "./tree";
import type { CriteriaVersion, DraftNodeRows } from "./version";

/*
 * L19 AD-03: Quản trị adds, removes and reorders the nodes of a draft Phiên bản tiêu chí (#23), so the tree
 * matches a new text with more or fewer kinds of product or Tiêu chí. Content edits are edit.ts (#22).
 */

const id = z.string().min(1);
const parent = <const P extends readonly [DraftNodeKind, ...DraftNodeKind[]]>(...kinds: P) => z.object({ node: z.enum(kinds), id });

/** One node to add: its kind, its parent and its values. It goes at the end of its siblings. */
export const nodeAdditionSchema = z.discriminatedUnion("node", [
  z.object({ node: z.literal("productGroup"), values: z.strictObject({ name: required }) }),
  z.object({ node: z.literal("subgroup"), parent: parent("productGroup"), values: z.strictObject({ name: required }) }),
  z.object({ node: z.literal("set"), parent: parent("subgroup"), values: z.strictObject({ code: required, name: required, totalPoints: points }) }),
  z.object({ node: z.literal("exclusion"), parent: parent("set"), values: z.strictObject({ description: required }) }),
  z.object({ node: z.literal("part"), parent: parent("set"), values: z.strictObject({ code: required, name: required, points }) }),
  z.object({ node: z.literal("section"), parent: parent("part"), values: z.strictObject({ code: required, name: required, points }) }),
  z.object({ node: z.literal("criterionGroup"), parent: parent("section"), values: z.strictObject({ code: required, name: required, points }) }),
  z.object({
    node: z.literal("criterion"),
    // Directly in a Mục, or in one of its Nhóm tiêu chí.
    parent: parent("section", "criterionGroup"),
    values: z.strictObject({ code: required, name: required, maxPoints: points, requirement: optionalText.default(""), note: optionalText.default("") }),
  }),
  z.object({
    node: z.literal("scoreLevel"),
    parent: parent("criterion"),
    values: z.strictObject({ description: required, points, minimumStar: minimumStar.default(null), branch: branch.default(null) }),
  }),
]);

export type NodeAddition = z.input<typeof nodeAdditionSchema>;
type ParsedAddition = z.output<typeof nodeAdditionSchema>;

export interface AddNodeInput {
  versionId: string;
  addition: NodeAddition;
}

export interface AddNodeResult extends DraftChangeResult {
  nodeId: string;
}

const nodeRefSchema = z.object({ node: z.enum(DRAFT_NODE_KINDS), id });

export interface RemoveNodeInput {
  versionId: string;
  node: DraftNodeKind;
  id: string;
}

export type MoveDirection = "up" | "down";

export interface MoveNodeInput {
  versionId: string;
  node: DraftNodeKind;
  id: string;
  /** Up is towards the start of the siblings (a lower `position`). */
  direction: MoveDirection;
}

/** The stored row of a new node, without its position; the parent is checked to be in the version. */
async function newRow(tx: Tx, version: CriteriaVersion, nodeId: string, a: ParsedAddition): Promise<{ kind: DraftNodeKind; row: DraftNodeRows[DraftNodeKind] }> {
  const position = 0;
  switch (a.node) {
    case "productGroup":
      return { kind: a.node, row: { id: nodeId, ...a.values, position } };
    case "subgroup":
      await findDraftNode(tx, version, "productGroup", a.parent.id);
      return { kind: a.node, row: { id: nodeId, productGroupId: a.parent.id, ...a.values, position } };
    case "set":
      await findDraftNode(tx, version, "subgroup", a.parent.id);
      return {
        kind: a.node,
        row: { id: nodeId, subgroupId: a.parent.id, ...a.values, headerNote: "", footerNote: "", extractionNote: "", sourcePages: [], position },
      };
    case "exclusion":
    case "part":
      await findDraftNode(tx, version, "set", a.parent.id);
      return { kind: a.node, row: { id: nodeId, setId: a.parent.id, ...a.values, position } };
    case "section": {
      const part = await findDraftNode(tx, version, "part", a.parent.id);
      return { kind: a.node, row: { id: nodeId, setId: part.setId, partId: part.id, ...a.values, position } };
    }
    case "criterionGroup": {
      const section = await findDraftNode(tx, version, "section", a.parent.id);
      return { kind: a.node, row: { id: nodeId, setId: section.setId, sectionId: section.id, ...a.values, position } };
    }
    case "criterion": {
      const where =
        a.parent.node === "criterionGroup"
          ? await findDraftNode(tx, version, "criterionGroup", a.parent.id).then((g) => ({ setId: g.setId, sectionId: g.sectionId, groupId: g.id }))
          : await findDraftNode(tx, version, "section", a.parent.id).then((s) => ({ setId: s.setId, sectionId: s.id, groupId: null }));
      return { kind: a.node, row: { id: nodeId, ...where, ...a.values, extractionNote: "", position } };
    }
    case "scoreLevel": {
      const criterion = await findDraftNode(tx, version, "criterion", a.parent.id);
      return { kind: a.node, row: { id: nodeId, setId: criterion.setId, criterionId: criterion.id, ...a.values, systemAdded: false, position } };
    }
  }
}

/** L19 AD-03: adds one node at the end of its siblings; returns its id and the check after it. Quản trị only. */
export function addNode(deps: CoreDeps) {
  return async (actor: Actor, input: AddNodeInput): Promise<AddNodeResult> => {
    authorize(actor, "criteria.edit");
    const addition = parseOrRefuse(nodeAdditionSchema, input.addition, "values", "Nút cần thêm không hợp lệ");
    const nodeId = deps.ids.next();
    const result = await changeDraft(deps, actor, input.versionId, async (tx, version, tree) => {
      const { kind, row } = await newRow(tx, version, nodeId, addition);
      const rows = await tree();
      row.position = nextPosition(siblingsOf(rows, kind, row));
      await tx.criteriaVersions.insertNode(kind, version.id, row);
      // A new Tiêu chí always offers "Không đáp ứng, 0 điểm" (GLOSSARY.md, Mức điểm).
      const zeroLevel =
        kind === "criterion"
          ? { id: deps.ids.next(), setId: (row as DraftNodeRows["criterion"]).setId, criterionId: nodeId, description: SYSTEM_ZERO_LEVEL, points: 0, minimumStar: null, branch: null, systemAdded: true, position: 0 }
          : null;
      if (zeroLevel) await tx.criteriaVersions.insertNode("scoreLevel", version.id, zeroLevel);
      const added = withNode(rows, kind, row);
      return {
        rowsAfter: zeroLevel ? withNode(added, "scoreLevel", zeroLevel) : added,
        action: "criteria.draft.node_added",
        node: kind,
        nodeId,
        before: null,
        after: { ...row },
        metadata: zeroLevel ? { added: { scoreLevel: 1 } } : undefined,
      };
    });
    return { ...result, nodeId };
  };
}

/** L19 AD-03: removes one node with all of its children; returns the check after it. Quản trị only. */
export function removeNode(deps: CoreDeps) {
  return async (actor: Actor, input: RemoveNodeInput): Promise<DraftChangeResult> => {
    authorize(actor, "criteria.edit");
    const ref = parseOrRefuse(nodeRefSchema, { node: input.node, id: input.id }, "", "Nút cần xóa không hợp lệ");
    return changeDraft(deps, actor, input.versionId, async (tx, version, tree) => {
      const row = await findDraftNode(tx, version, ref.node, ref.id);
      const rows = await tree();
      const removed = descendantsOf(rows, ref.node, ref.id);
      await tx.criteriaVersions.deleteNode(ref.node, ref.id);
      return {
        action: "criteria.draft.node_removed",
        node: ref.node,
        nodeId: ref.id,
        before: { ...row },
        after: null,
        metadata: { removed },
        rowsAfter: withoutNode(rows, ref.node, ref.id),
      };
    });
  };
}

/**
 * L19 AD-03: swaps one node with its neighbour among its siblings; returns the check after it. Moving the
 * first node up or the last one down changes nothing. Quản trị only.
 */
export function moveNode(deps: CoreDeps) {
  return async (actor: Actor, input: MoveNodeInput): Promise<DraftChangeResult> => {
    authorize(actor, "criteria.edit");
    const ref = parseOrRefuse(
      nodeRefSchema.extend({ direction: z.enum(["up", "down"]) }),
      { node: input.node, id: input.id, direction: input.direction },
      "",
      "Nút cần di chuyển không hợp lệ",
    );
    return changeDraft(deps, actor, input.versionId, async (tx, version, tree) => {
      const row = await findDraftNode(tx, version, ref.node, ref.id);
      const rows = await tree();
      const siblings = siblingsOf(rows, ref.node, row);
      const from = siblings.findIndex((s) => s.kind === ref.node && s.id === ref.id);
      const to = ref.direction === "up" ? from - 1 : from + 1;
      if (from < 0 || to < 0 || to >= siblings.length) return null;
      const order = [...siblings];
      [order[from], order[to]] = [order[to]!, order[from]!];
      // Renumber the whole sequence 0..n-1, so positions stay distinct whatever they were before.
      const changed = order.map((s, position) => ({ ...s, position })).filter((s, i) => order[i]!.position !== s.position);
      let rowsAfter = rows;
      for (const kind of new Set(changed.map((s) => s.kind))) {
        const positions = changed.filter((s) => s.kind === kind);
        await tx.criteriaVersions.setPositions(kind, positions);
        rowsAfter = withPositions(rowsAfter, kind, positions);
      }
      return {
        rowsAfter,
        action: "criteria.draft.node_moved",
        node: ref.node,
        nodeId: ref.id,
        before: { position: from },
        after: { position: to },
        metadata: { direction: ref.direction },
      };
    });
  };
}
