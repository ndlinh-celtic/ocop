import { z } from "zod";
import { DomainError } from "../shared/errors";
import type { RankThresholds, Star } from "./model";
import type { CriterionGroupRow, CriterionRow, PartRow, ProductGroupRow, ScoreLevelRow, SectionRow, SetRows, SubgroupRow, VersionRows } from "./version";

/*
 * Reads the file format of the QĐ 26/2026 extraction (docs/tieu-chi/ocop_tieu_chi_qd26_2026.json) into the
 * rows of a draft Phiên bản tiêu chí. It checks the format and the structure it needs to build the tree; the
 * point sums are left to validation (#19), so a draft with extraction errors still imports and can be fixed.
 */

/** Ngưỡng hạng of QĐ 26; the file does not carry them, Quản trị can change them in the draft. */
export const QD26_THRESHOLDS: RankThresholds = { 2: 30, 3: 50, 4: 70, 5: 90 };

/** Description of the 0-point level the system adds (GLOSSARY.md: Mức điểm). */
export const SYSTEM_ZERO_LEVEL = "Không đáp ứng";
/** Description of the full-points level made for a Tiêu chí printed as a single line (empty `lua_chon`). */
export const SINGLE_LINE_LEVEL = "Đáp ứng";

const text = z.string().trim();
const required = text.min(1, "Không được để trống");
const points = z.number({ error: "Phải là số" }).finite().min(0, "Không được âm");
const date = z.iso.date({ error: "Phải là ngày dạng YYYY-MM-DD" });

const level = z.object({
  thu_tu: z.number().int().optional(),
  mo_ta: required,
  diem: points,
  sao_toi_thieu: z.union([z.literal(3), z.literal(4), z.literal(5), z.null()], { error: "Phải là 3, 4, 5 hoặc null" }).default(null),
});

const criterion = z.object({
  phan: required,
  phan_ten: required,
  phan_diem: points,
  muc: z.union([required, z.number().transform(String)]),
  muc_ten: required,
  muc_diem: points,
  nhom_ma: required.optional(),
  nhom_ten: required.optional(),
  nhom_diem: points.optional(),
  nhom_con: required.optional(),
  ma: z.union([required, z.number().transform(String)]),
  ten: required,
  diem_toi_da: points,
  yeu_cau: text.default(""),
  ghi_chu: text.default(""),
  ghi_chu_trich_xuat: text.default(""),
  lua_chon: z.array(level),
});

const criteriaSet = z.object({
  bo: z.union([z.number().int().transform(String), required]),
  ten_bo: required,
  san_pham: required,
  nhom: text.default(""),
  trang_pdf: z.array(z.number().int()).default([]),
  ghi_chu_dau_phieu: text.default(""),
  ghi_chu_cuoi_phieu: text.default(""),
  ghi_chu_trich_xuat: text.default(""),
  tong_diem: z.union([points, z.string().trim().regex(/^\d+(\.\d+)?$/, "Phải là số").transform(Number)]),
  tieu_chi: z.array(criterion).min(1, "Bộ tiêu chí phải có ít nhất một tiêu chí"),
});

const file = z.object({
  van_ban: required,
  ngay_ban_hanh: date,
  hieu_luc: date,
  bo_tieu_chi: z.array(criteriaSet).min(1, "Tệp phải có ít nhất một bộ tiêu chí"),
});

type RawFile = z.infer<typeof file>;
type RawCriterion = z.infer<typeof criterion>;

export interface ImportIssue {
  /** Where in the file, e.g. "Bộ 4 › tiêu chí 1.6 › lua_chon[2].diem". */
  location: string;
  message: string;
}

/** The file was refused; `issues` lists every problem found, each with its location. */
export class CriteriaImportError extends DomainError {
  constructor(readonly issues: ImportIssue[]) {
    const shown = issues.slice(0, 5).map((i) => `${i.location}: ${i.message}`);
    const more = issues.length > shown.length ? ` (và ${issues.length - shown.length} lỗi khác)` : "";
    super("invalid_criteria_file", `Tệp tiêu chí không đúng định dạng. ${shown.join("; ")}${more}`);
    this.name = "CriteriaImportError";
  }
}

export interface ParsedVersionFile {
  legalBasis: string;
  issuedOn: string;
  effectiveOn: string;
  rows: VersionRows;
}

/** Turns a zod path into a location a Quản trị can find in the file: the Bộ and Tiêu chí numbers first. */
function locate(raw: unknown, path: readonly PropertyKey[]): string {
  const parts: string[] = [];
  let node: unknown = raw;
  let rest = [...path];
  const at = (n: unknown, k: PropertyKey) => (n && typeof n === "object" ? (n as Record<PropertyKey, unknown>)[k] : undefined);
  if (rest[0] === "bo_tieu_chi" && typeof rest[1] === "number") {
    node = at(at(raw, "bo_tieu_chi"), rest[1]);
    parts.push(`Bộ ${String(at(node, "bo") ?? `#${rest[1] + 1}`)}`);
    rest = rest.slice(2);
    if (rest[0] === "tieu_chi" && typeof rest[1] === "number") {
      const c = at(at(node, "tieu_chi"), rest[1]);
      parts.push(`tiêu chí ${String(at(c, "ma") ?? `#${rest[1] + 1}`)}`);
      rest = rest.slice(2);
    }
  }
  const tail = rest.map((k, i) => (typeof k === "number" ? `[${k}]` : `${i === 0 ? "" : "."}${String(k)}`)).join("");
  if (tail) parts.push(tail);
  return parts.join(" › ") || "(tệp)";
}

const BRANCH_PREFIX = /^([a-z])\.\s/;
const GROUP_LABEL = /^(\S+)\s+(.+?)\s*\((\d+(?:[.,]\d+)?)\s*đ\)$/;
const EXCLUSION_HEAD = /^(?:hồ sơ\s+)?bị loại khi\s*:?\s*/i;

/**
 * Splits "Hồ sơ bị loại khi: A hoặc B; hoặc C" into Điều kiện loại [A, B, C]: at ";" and "hoặc" outside
 * parentheses, so "(hoặc tương đương)" stays inside its condition. No such header, no conditions.
 */
export function splitExclusions(header: string): string[] {
  const head = EXCLUSION_HEAD.exec(header);
  if (!head) return [];
  const body = header.slice(head[0].length);
  const pieces: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth > 0) continue;
    if (ch === ";") {
      pieces.push(body.slice(start, i));
      start = i + 1;
    } else {
      const or = /^\s+hoặc(?=\s)/iu.exec(body.slice(i));
      if (or) {
        pieces.push(body.slice(start, i));
        start = i + or[0].length;
        i = start - 1;
      }
    }
  }
  pieces.push(body.slice(start));
  return pieces
    .map((p) => p.trim().replace(/^hoặc\s+/i, "").replace(/[\s.;,]+$/, ""))
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
}

/** Parses and normalises the file; throws CriteriaImportError listing every problem. Ids come from `nextId`. */
export function parseQd26File(content: string, nextId: () => string): ParsedVersionFile {
  let raw: unknown;
  try {
    raw = JSON.parse(content.replace(/^\uFEFF/, ""));
  } catch (err) {
    throw new CriteriaImportError([{ location: "(tệp)", message: `Không phải JSON hợp lệ: ${(err as Error).message}` }]);
  }
  const parsed = file.safeParse(raw);
  if (!parsed.success) {
    throw new CriteriaImportError(parsed.error.issues.map((i) => ({ location: locate(raw, i.path), message: i.message })));
  }
  const issues: ImportIssue[] = [];
  const rows = buildRows(parsed.data, nextId, (path, message) => issues.push({ location: locate(raw, path), message }));
  if (issues.length > 0) throw new CriteriaImportError(issues);
  return { legalBasis: parsed.data.van_ban, issuedOn: parsed.data.ngay_ban_hanh, effectiveOn: parsed.data.hieu_luc, rows };
}

type Report = (path: PropertyKey[], message: string) => void;

function buildRows(data: RawFile, nextId: () => string, report: Report): VersionRows {
  const productGroups: ProductGroupRow[] = [];
  const subgroups: SubgroupRow[] = [];
  const sets: SetRows[] = [];

  data.bo_tieu_chi.forEach((b, bi) => {
    let group = productGroups.find((g) => g.name === b.san_pham);
    if (!group) productGroups.push((group = { id: nextId(), name: b.san_pham, position: productGroups.length }));
    // A Bộ printed without a Phân nhóm sits in a Phân nhóm of its own name.
    const subgroupName = b.nhom || b.ten_bo;
    let subgroup = subgroups.find((s) => s.productGroupId === group.id && s.name === subgroupName);
    if (!subgroup) {
      subgroup = { id: nextId(), productGroupId: group.id, name: subgroupName, position: subgroups.filter((s) => s.productGroupId === group.id).length };
      subgroups.push(subgroup);
    }
    const setId = nextId();
    const positionInSubgroup = sets.filter((s) => s.set.subgroupId === subgroup.id).length;
    const out: SetRows = {
      set: {
        id: setId,
        subgroupId: subgroup.id,
        code: b.bo,
        name: b.ten_bo,
        totalPoints: b.tong_diem,
        headerNote: b.ghi_chu_dau_phieu,
        footerNote: b.ghi_chu_cuoi_phieu,
        extractionNote: b.ghi_chu_trich_xuat,
        sourcePages: b.trang_pdf,
        position: positionInSubgroup,
      },
      exclusions: splitExclusions(b.ghi_chu_dau_phieu).map((description, position) => ({ id: nextId(), setId, description, position })),
      parts: [],
      sections: [],
      criterionGroups: [],
      criteria: [],
      levels: [],
    };
    const sectionSlots = new Map<string, number>();
    b.tieu_chi.forEach((c, ci) => {
      const at = (...rest: PropertyKey[]) => ["bo_tieu_chi", bi, "tieu_chi", ci, ...rest];
      const part = partFor(out, c, nextId, report, at);
      const section = sectionFor(out, part, c, nextId, report, at);
      const slot = () => {
        const n = sectionSlots.get(section.id) ?? 0;
        sectionSlots.set(section.id, n + 1);
        return n;
      };
      const group = groupFor(out, section, c, nextId, report, at, slot);
      const criterionId = nextId();
      const row: CriterionRow = {
        id: criterionId,
        setId,
        sectionId: section.id,
        groupId: group?.id ?? null,
        code: c.ma,
        name: c.ten,
        requirement: c.yeu_cau,
        maxPoints: c.diem_toi_da,
        note: c.ghi_chu,
        extractionNote: c.ghi_chu_trich_xuat,
        position: group ? out.criteria.filter((x) => x.groupId === group.id).length : slot(),
      };
      out.criteria.push(row);
      out.levels.push(...levelsFor(c, setId, criterionId, nextId, report, at));
    });
    sets.push(out);
  });
  return { thresholds: QD26_THRESHOLDS, productGroups, subgroups, sets };
}

type At = (...rest: PropertyKey[]) => PropertyKey[];

function partFor(out: SetRows, c: RawCriterion, nextId: () => string, report: Report, at: At): PartRow {
  const found = out.parts.find((p) => p.code === c.phan);
  if (!found) {
    const part = { id: nextId(), setId: out.set.id, code: c.phan, name: c.phan_ten, points: c.phan_diem, position: out.parts.length };
    out.parts.push(part);
    return part;
  }
  if (found.name !== c.phan_ten || found.points !== c.phan_diem) report(at("phan_diem"), `Phần ${c.phan} khai báo khác nhau giữa các tiêu chí`);
  return found;
}

function sectionFor(out: SetRows, part: PartRow, c: RawCriterion, nextId: () => string, report: Report, at: At): SectionRow {
  const found = out.sections.find((s) => s.code === c.muc);
  if (!found) {
    const section = {
      id: nextId(),
      setId: out.set.id,
      partId: part.id,
      code: c.muc,
      name: c.muc_ten,
      points: c.muc_diem,
      position: out.sections.filter((s) => s.partId === part.id).length,
    };
    out.sections.push(section);
    return section;
  }
  if (found.partId !== part.id) report(at("muc"), `Mục ${c.muc} nằm ở hai Phần khác nhau`);
  else if (found.name !== c.muc_ten || found.points !== c.muc_diem) report(at("muc_diem"), `Mục ${c.muc} khai báo khác nhau giữa các tiêu chí`);
  return found;
}

/** Nhóm tiêu chí comes as `nhom_ma`/`nhom_ten`/`nhom_diem`, or as one label `nhom_con` "6.1 Ngoại hình (10đ)". */
function groupFor(out: SetRows, section: SectionRow, c: RawCriterion, nextId: () => string, report: Report, at: At, slot: () => number): CriterionGroupRow | null {
  let declared: { code: string; name: string; points: number } | null = null;
  if (c.nhom_con !== undefined) {
    const m = GROUP_LABEL.exec(c.nhom_con);
    if (!m) {
      report(at("nhom_con"), 'Phải có dạng "<mã> <tên> (<điểm>đ)"');
      return null;
    }
    declared = { code: m[1]!, name: m[2]!, points: Number(m[3]!.replace(",", ".")) };
  } else if (c.nhom_ma !== undefined || c.nhom_ten !== undefined || c.nhom_diem !== undefined) {
    if (c.nhom_ma === undefined || c.nhom_ten === undefined || c.nhom_diem === undefined) {
      report(at("nhom_ma"), "Cần đủ nhom_ma, nhom_ten và nhom_diem");
      return null;
    }
    declared = { code: c.nhom_ma, name: c.nhom_ten, points: c.nhom_diem };
  }
  if (!declared) return null;
  const found = out.criterionGroups.find((g) => g.sectionId === section.id && g.code === declared.code);
  if (found) {
    if (found.name !== declared.name || found.points !== declared.points) report(at(c.nhom_con !== undefined ? "nhom_con" : "nhom_diem"), `Nhóm tiêu chí ${declared.code} khai báo khác nhau giữa các tiêu chí`);
    return found;
  }
  const group = { id: nextId(), setId: out.set.id, sectionId: section.id, ...declared, position: slot() };
  out.criterionGroups.push(group);
  return group;
}

/**
 * Mức điểm of one Tiêu chí, in file order (`thu_tu`). A single-line Tiêu chí becomes 0 and full points; every
 * Tiêu chí without a 0-point level gets one, marked as added by the system, in first position. Branch labels
 * come from an "a. "/"b. " prefix, and must cover all levels or none.
 */
function levelsFor(c: RawCriterion, setId: string, criterionId: string, nextId: () => string, report: Report, at: At): ScoreLevelRow[] {
  const make = (description: string, points: number, minimumStar: Star | null, branch: string | null, systemAdded: boolean, position: number): ScoreLevelRow => ({
    id: nextId(),
    setId,
    criterionId,
    description,
    points,
    minimumStar,
    branch,
    systemAdded,
    position,
  });
  if (c.lua_chon.length === 0) {
    return [make(SYSTEM_ZERO_LEVEL, 0, null, null, true, 0), make(SINGLE_LINE_LEVEL, c.diem_toi_da, null, null, false, 1)];
  }
  const ordered = [...c.lua_chon].map((l, i) => ({ ...l, index: i })).sort((a, b) => (a.thu_tu ?? a.index) - (b.thu_tu ?? b.index));
  const branches = ordered.map((l) => BRANCH_PREFIX.exec(l.mo_ta)?.[1] ?? null);
  const branched = branches.filter((b) => b !== null).length;
  if (branched > 0 && branched < ordered.length) report(at("lua_chon"), 'Hoặc mọi mức có nhãn nhánh ("a. ", "b. "), hoặc không mức nào có');
  else if (branched > 0 && new Set(branches).size < 2) report(at("lua_chon"), "Tiêu chí chia nhánh phải có ít nhất hai nhánh");
  if (/nhánh/i.test(c.ghi_chu_trich_xuat) && branched === 0) report(at("lua_chon"), "Ghi chú trích xuất nói có nhánh nhưng các mức không có nhãn nhánh");
  const hasZero = ordered.some((l) => l.diem === 0);
  const offset = hasZero ? 0 : 1;
  const levels = ordered.map((l, i) => make(l.mo_ta, l.diem, l.sao_toi_thieu as Star | null, branched > 0 ? branches[i]! : null, false, i + offset));
  return hasZero ? levels : [make(SYSTEM_ZERO_LEVEL, 0, null, null, true, 0), ...levels];
}
