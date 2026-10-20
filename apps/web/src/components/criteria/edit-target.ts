import type { DraftEdit, NodeAddition } from "@ocop/core";
import type { ReactNode } from "react";

/** One editable node of a draft as the read-only views show it: what to edit and its current values (L19 AD-03). */
export interface EditTarget {
  node: DraftEdit["node"];
  /** Absent for the version's own fields and its Ngưỡng hạng. */
  id?: string;
  /** Current value of each editable field, keyed as in DraftEdit `changes`. */
  values: Record<string, string | number | null>;
  /** What is being edited, for the button's accessible name, e.g. "Tiêu chí 1.1". */
  label: string;
}

/** A place where a node can be added to a draft (#23): the kind of node, its parent, and what to call it. */
export interface AddTarget {
  add: NodeAddition["node"];
  /** Absent for a Nhóm sản phẩm, which sits directly in the version. */
  parent?: { node: Exclude<DraftEdit["node"], "version" | "thresholds">; id: string };
  /** The button text, e.g. "Thêm tiêu chí". */
  label: string;
}

export const isAddTarget = (target: EditTarget | AddTarget): target is AddTarget => "add" in target;

/**
 * Slot the shared criteria views call next to each editable node (an EditTarget: edit, move, remove) and
 * where a node can be added (an AddTarget); only the admin draft pages pass one.
 */
export type EditSlot = (target: EditTarget | AddTarget) => ReactNode;
