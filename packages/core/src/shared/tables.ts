type UnionToIntersection<U> = (U extends unknown ? (u: U) => void : never) extends (i: infer I) => void ? I : never;

/** The tables merged into one, keys kept literal. */
export type Merged<T extends readonly object[]> = UnionToIntersection<T[number]> extends infer M ? { [K in keyof M]: M[K] } : never;

/**
 * Merges the tables that modules declare (consumers, jobs, permissions…) into one; two modules declaring the same key is a
 * programming error, refused when the core loads rather than letting one silently win.
 */
export function mergeTables<const T extends readonly object[]>(what: string, tables: T): Merged<T> {
  const merged: Record<string, unknown> = {};
  for (const table of tables) {
    for (const [key, value] of Object.entries(table)) {
      if (key in merged) throw new Error(`Duplicate ${what} "${key}"`);
      merged[key] = value;
    }
  }
  return merged as Merged<T>;
}
