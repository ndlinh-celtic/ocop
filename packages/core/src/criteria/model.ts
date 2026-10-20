/** A Hạng sao, 1 to 5. */
export type Star = 1 | 2 | 3 | 4 | 5;

export const STARS: readonly Star[] = [1, 2, 3, 4, 5];

/** Ngưỡng hạng: the minimum total for each Hạng sao from 2 to 5 (QĐ 26: 30/50/70/90). Below the 2-star threshold is 1 star. */
export type RankThresholds = Readonly<Record<2 | 3 | 4 | 5, number>>;

/** Mức điểm. `minimumStar` is the Sao tối thiểu printed as ***, ****, *****; `branch` is the a/b label when the Tiêu chí splits into cases. */
export interface ScoreLevel {
  readonly description: string;
  readonly points: number;
  readonly minimumStar: Star | null;
  readonly branch: string | null;
}

/** Tiêu chí: the grader picks exactly one Mức điểm. `code` is unique within a Bộ tiêu chí. */
export interface Criterion {
  readonly kind: "criterion";
  readonly code: string;
  readonly name: string;
  readonly requirement: string;
  readonly maxPoints: number;
  readonly note: string;
  readonly levels: readonly ScoreLevel[];
}

/** Nhóm tiêu chí: optional block between a Mục and its Tiêu chí (e.g. "6.1 Ngoại hình"). */
export interface CriterionGroup {
  readonly kind: "group";
  readonly code: string;
  readonly name: string;
  readonly points: number;
  readonly criteria: readonly Criterion[];
}

/** Mục: a block of a Phần (e.g. "1. Tổ chức sản xuất"). */
export interface Section {
  readonly code: string;
  readonly name: string;
  readonly points: number;
  readonly items: readonly (Criterion | CriterionGroup)[];
}

/** Phần A/B/C. */
export interface Part {
  readonly code: string;
  readonly name: string;
  readonly points: number;
  readonly sections: readonly Section[];
}

/** Bộ tiêu chí: the official score sheet for one kind of product within a Phiên bản tiêu chí. */
export interface CriteriaSet {
  readonly code: string;
  readonly name: string;
  readonly totalPoints: number;
  readonly parts: readonly Part[];
}

/** Points per Tiêu chí code. Values may be fractional when averaged over several score sheets. */
export type CriterionScores = Readonly<Record<string, number>>;

/** The Tiêu chí of a Phần in sheet order, those inside a Nhóm tiêu chí included. Keeps the stored type of a stored Phần. */
export function criteriaOf<C extends Criterion>(part: {
  readonly sections: readonly { readonly items: readonly (C | { readonly kind: "group"; readonly criteria: readonly C[] })[] }[];
}): C[] {
  return part.sections.flatMap((s) => s.items.flatMap((i) => (i.kind === "group" ? i.criteria : [i])));
}
