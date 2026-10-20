import type { DraftEdit } from "@ocop/core";
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

/** Slot the shared criteria views call next to each editable node; only the admin draft pages pass one. */
export type EditSlot = (target: EditTarget) => ReactNode;
