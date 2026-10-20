import type { RankThresholds, Star } from "./model";

/** Phiên bản tiêu chí: draft until published, then immutable (ADR 0006). Published only one way. */
export type VersionStatus = "draft" | "published";

export interface CriteriaVersion {
  id: string;
  /** Văn bản căn cứ, e.g. "26/2026/QĐ-TTg". Several versions may share one (a corrected copy). */
  legalBasis: string;
  /** Ngày ban hành and ngày hiệu lực as calendar dates (YYYY-MM-DD); hiệu lực is recorded only. */
  issuedOn: string;
  effectiveOn: string;
  status: VersionStatus;
  createdAt: Date;
  /** Null when a system job (the seed) created it. */
  createdBy: string | null;
  publishedAt: Date | null;
  publishedBy: string | null;
  /** The version this one was copied from, for lookup only: there is no inheritance. */
  copiedFrom: string | null;
}

/*
 * The tree of one version as flat rows, the shape it is stored, copied (#21) and validated (#19) in.
 * Ids are UUIDv7 from IdGen; `position` orders siblings; `points` are the declared values.
 */

export interface ProductGroupRow {
  id: string;
  name: string;
  position: number;
}

export interface SubgroupRow {
  id: string;
  productGroupId: string;
  name: string;
  position: number;
}

export interface CriteriaSetRow {
  id: string;
  subgroupId: string;
  code: string;
  name: string;
  totalPoints: number;
  headerNote: string;
  footerNote: string;
  extractionNote: string;
  sourcePages: number[];
  position: number;
}

export interface ExclusionConditionRow {
  id: string;
  setId: string;
  description: string;
  position: number;
}

export interface PartRow {
  id: string;
  setId: string;
  code: string;
  name: string;
  points: number;
  position: number;
}

export interface SectionRow {
  id: string;
  setId: string;
  partId: string;
  code: string;
  name: string;
  points: number;
  position: number;
}

/** Nhóm tiêu chí; shares the `position` sequence of its Mục with the Tiêu chí placed directly in it. */
export interface CriterionGroupRow {
  id: string;
  setId: string;
  sectionId: string;
  code: string;
  name: string;
  points: number;
  position: number;
}

export interface CriterionRow {
  id: string;
  setId: string;
  sectionId: string;
  groupId: string | null;
  code: string;
  name: string;
  requirement: string;
  maxPoints: number;
  note: string;
  extractionNote: string;
  position: number;
}

export interface ScoreLevelRow {
  id: string;
  setId: string;
  criterionId: string;
  description: string;
  points: number;
  minimumStar: Star | null;
  branch: string | null;
  /** The "Không đáp ứng, 0 điểm" level added because the text had no 0-point level. */
  systemAdded: boolean;
  position: number;
}

/** Everything below one Bộ tiêu chí. */
export interface SetRows {
  set: CriteriaSetRow;
  exclusions: ExclusionConditionRow[];
  parts: PartRow[];
  sections: SectionRow[];
  criterionGroups: CriterionGroupRow[];
  criteria: CriterionRow[];
  levels: ScoreLevelRow[];
}

export interface VersionRows {
  thresholds: RankThresholds;
  productGroups: ProductGroupRow[];
  subgroups: SubgroupRow[];
  sets: SetRows[];
}

export interface VersionSummary extends CriteriaVersion {
  setCount: number;
}

/** Cây phân loại of a version with a count of Tiêu chí per Bộ tiêu chí. */
export interface VersionTaxonomy {
  thresholds: RankThresholds;
  productGroups: ProductGroupRow[];
  subgroups: SubgroupRow[];
  sets: (CriteriaSetRow & { criterionCount: number })[];
}

export interface CriteriaVersionRepo {
  /** Inserts a version with its whole tree. */
  insert(version: CriteriaVersion, rows: VersionRows): Promise<void>;
  findById(id: string): Promise<CriteriaVersion | null>;
  /** Newest first. */
  list(filter: { status?: VersionStatus }): Promise<VersionSummary[]>;
  taxonomy(versionId: string): Promise<VersionTaxonomy>;
  findSet(setId: string): Promise<{ versionId: string; rows: SetRows } | null>;
}
