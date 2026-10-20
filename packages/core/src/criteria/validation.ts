import { sum } from "./helpers";
import type { SetRows, VersionRows } from "./version";

export type ValidationIssueCode =
  | "max_points_mismatch"
  | "group_points_mismatch"
  | "section_points_mismatch"
  | "part_points_mismatch"
  | "set_total_mismatch"
  | "duplicate_criterion_code"
  | "missing_zero_level"
  | "duplicate_name"
  | "empty_version"
  | "empty_group"
  | "thresholds_not_increasing"
  | "threshold_exceeds_total";

/** One problem found by the check, located by Bộ tiêu chí (null for the whole version) and mã tiêu chí. */
export interface ValidationIssue {
  code: ValidationIssueCode;
  setId: string | null;
  setCode: string | null;
  criterionCode: string | null;
  /** Vietnamese, shown as is. */
  message: string;
}

/** Declared and computed points are decimals (numeric(7,2)); compare them past float noise. */
const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** Rounds away float noise for messages: 17.000000001 → 17. */
const shown = (n: number) => Math.round(n * 100) / 100;

/*
 * Each level is compared with the declared points of the level right below it, so one wrong figure
 * is reported where it is, not again at every level above.
 */
function setIssues({ set, parts, sections, criterionGroups, criteria, levels }: SetRows): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const report = (code: ValidationIssueCode, criterionCode: string | null, message: string) =>
    issues.push({ code, setId: set.id, setCode: set.code, criterionCode, message });
  const mismatch = (label: string, declared: number, below: string, computed: number) =>
    `${label}: khai báo ${shown(declared)} điểm, tổng ${below} là ${shown(computed)}`;

  for (const c of criteria) {
    const own = levels.filter((l) => l.criterionId === c.id).map((l) => l.points);
    const top = Math.max(0, ...own);
    if (!same(top, c.maxPoints)) report("max_points_mismatch", c.code, `Điểm tối đa ${shown(c.maxPoints)} khác mức cao nhất ${shown(top)}`);
    // Every Tiêu chí must let the grader pick "Không đáp ứng, 0 điểm" (spec #16; the import adds it when the sheet has none).
    if (!own.some((points) => same(points, 0))) report("missing_zero_level", c.code, "Tiêu chí chưa có mức 0 điểm (Không đáp ứng)");
  }
  for (const g of criterionGroups) {
    const computed = sum(criteria.filter((c) => c.groupId === g.id).map((c) => c.maxPoints));
    if (!same(computed, g.points)) report("group_points_mismatch", null, mismatch(`Nhóm tiêu chí ${g.code}`, g.points, "các Tiêu chí", computed));
  }
  const partOf = new Map(parts.map((p) => [p.id, p]));
  for (const s of sections) {
    const computed =
      sum(criterionGroups.filter((g) => g.sectionId === s.id).map((g) => g.points)) +
      sum(criteria.filter((c) => c.sectionId === s.id && c.groupId === null).map((c) => c.maxPoints));
    if (!same(computed, s.points)) {
      report("section_points_mismatch", null, mismatch(`Mục ${s.code} (Phần ${partOf.get(s.partId)?.code ?? "?"})`, s.points, "các thành phần", computed));
    }
  }
  for (const p of parts) {
    const computed = sum(sections.filter((s) => s.partId === p.id).map((s) => s.points));
    if (!same(computed, p.points)) report("part_points_mismatch", null, mismatch(`Phần ${p.code}`, p.points, "các Mục", computed));
  }
  const total = sum(parts.map((p) => p.points));
  if (!same(total, set.totalPoints)) report("set_total_mismatch", null, mismatch("Tổng điểm bộ", set.totalPoints, "các Phần", total));
  for (const [code, n] of countBy(criteria.map((c) => c.code))) {
    if (n > 1) report("duplicate_criterion_code", code, `Mã tiêu chí ${code} xuất hiện ${n} lần trong bộ`);
  }
  return issues;
}

function countBy(keys: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return counts;
}

/** Names compare as people read them: case and surrounding spaces do not make two names different. */
const nameKey = (name: string) => name.trim().normalize("NFC").toLocaleLowerCase("vi");

/** Each sibling whose name an earlier sibling already has. */
function repeated<T extends { name: string }>(siblings: T[]): T[] {
  const seen = new Set<string>();
  return siblings.filter((s) => (seen.has(nameKey(s.name)) ? true : (seen.add(nameKey(s.name)), false)));
}

function taxonomyIssues(rows: VersionRows): ValidationIssue[] {
  const issue = (message: string, set: SetRows["set"] | null = null): ValidationIssue => ({
    code: "duplicate_name",
    setId: set?.id ?? null,
    setCode: set?.code ?? null,
    criterionCode: null,
    message,
  });
  const issues = repeated(rows.productGroups).map((g) => issue(`Tên Nhóm sản phẩm "${g.name}" bị trùng`));
  for (const g of rows.productGroups) {
    for (const s of repeated(rows.subgroups.filter((s) => s.productGroupId === g.id))) {
      issues.push(issue(`Tên Phân nhóm "${s.name}" bị trùng trong Nhóm sản phẩm "${g.name}"`));
    }
  }
  for (const sg of rows.subgroups) {
    for (const s of repeated(rows.sets.map((s) => s.set).filter((s) => s.subgroupId === sg.id))) {
      issues.push(issue(`Tên Bộ tiêu chí "${s.name}" bị trùng trong Phân nhóm "${sg.name}"`, s));
    }
  }
  return issues;
}

/** A version with nothing to grade, or a branch of its Cây phân loại that leads to no Bộ tiêu chí. */
function emptinessIssues(rows: VersionRows): ValidationIssue[] {
  const at = { setId: null, setCode: null, criterionCode: null };
  if (rows.sets.length === 0) return [{ code: "empty_version", ...at, message: "Phiên bản tiêu chí chưa có Bộ tiêu chí nào" }];
  const issues: ValidationIssue[] = [];
  for (const g of rows.productGroups) {
    if (!rows.subgroups.some((s) => s.productGroupId === g.id)) {
      issues.push({ code: "empty_group", ...at, message: `Nhóm sản phẩm "${g.name}" chưa có Phân nhóm nào` });
    }
  }
  for (const sg of rows.subgroups) {
    if (!rows.sets.some((s) => s.set.subgroupId === sg.id)) {
      issues.push({ code: "empty_group", ...at, message: `Phân nhóm "${sg.name}" chưa có Bộ tiêu chí nào` });
    }
  }
  return issues;
}

const STEPS = [2, 3, 4, 5] as const;

function thresholdIssues(rows: VersionRows): ValidationIssue[] {
  const t = rows.thresholds;
  const issues: ValidationIssue[] = [];
  const at = { setId: null, setCode: null, criterionCode: null };
  for (const [lower, upper] of [[2, 3], [3, 4], [4, 5]] as const) {
    if (!(t[upper] > t[lower])) issues.push({ code: "thresholds_not_increasing", ...at, message: `Ngưỡng ${upper} sao phải lớn hơn ngưỡng ${lower} sao` });
  }
  for (const { set } of rows.sets) {
    const highest = STEPS.filter((s) => t[s] > set.totalPoints + 1e-6).at(-1);
    if (highest !== undefined) {
      issues.push({
        code: "threshold_exceeds_total",
        setId: set.id,
        setCode: set.code,
        criterionCode: null,
        message: `Ngưỡng ${highest} sao (${shown(t[highest])} điểm) vượt tổng điểm bộ (${shown(set.totalPoints)} điểm)`,
      });
    }
  }
  return issues;
}

/**
 * L19 AD-04: every problem that keeps a Phiên bản tiêu chí from being published, each located by its
 * Bộ tiêu chí and, where it applies, its mã tiêu chí (spec #16 stories 20-23). Pure: no I/O.
 */
export function findVersionIssues(rows: VersionRows): ValidationIssue[] {
  return [...thresholdIssues(rows), ...emptinessIssues(rows), ...taxonomyIssues(rows), ...rows.sets.flatMap(setIssues)];
}
