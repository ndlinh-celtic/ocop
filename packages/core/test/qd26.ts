import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Criterion, CriterionGroup, CriteriaSet, Part, RankThresholds, Section, Star } from "../src/criteria/model";

// Test-only reader for the extracted QĐ 26/2026 file; the real import (#18) lives in core later.
interface RawLevel { mo_ta: string; diem: number; sao_toi_thieu: number | null }
interface RawCriterion {
  phan: string; phan_ten: string; phan_diem: number;
  muc: string; muc_ten: string; muc_diem: number;
  nhom_con?: string;
  ma: string; ten: string; diem_toi_da: number; yeu_cau: string; ghi_chu: string;
  lua_chon: RawLevel[];
}
interface RawSet { bo: number; ten_bo: string; tong_diem: number; tieu_chi: RawCriterion[] }

const raw = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../docs/tieu-chi/ocop_tieu_chi_qd26_2026.json", import.meta.url)), "utf8"),
) as { bo_tieu_chi: RawSet[] };

export const QD26_THRESHOLDS: RankThresholds = { 2: 30, 3: 50, 4: 70, 5: 90 };

const BRANCH = /^([ab])\.\s/;

function toCriterion(c: RawCriterion): Criterion {
  return {
    kind: "criterion",
    code: c.ma,
    name: c.ten,
    requirement: c.yeu_cau,
    maxPoints: c.diem_toi_da,
    note: c.ghi_chu,
    levels: c.lua_chon.map((l) => ({
      description: l.mo_ta,
      points: l.diem,
      minimumStar: l.sao_toi_thieu as Star | null,
      branch: BRANCH.exec(l.mo_ta)?.[1] ?? null,
    })),
  };
}

export function qd26Set(no: number): CriteriaSet {
  const set = raw.bo_tieu_chi.find((b) => b.bo === no);
  if (!set) throw new Error(`no Bộ tiêu chí ${no}`);
  const parts: (Part & { sections: Section[] })[] = [];
  for (const c of set.tieu_chi) {
    let part = parts.find((p) => p.code === c.phan);
    if (!part) parts.push((part = { code: c.phan, name: c.phan_ten, points: c.phan_diem, sections: [] }));
    let section = part.sections.find((s) => s.code === c.muc) as (Section & { items: (Criterion | CriterionGroup)[] }) | undefined;
    if (!section) part.sections.push((section = { code: c.muc, name: c.muc_ten, points: c.muc_diem, items: [] }));
    const criterion = toCriterion(c);
    if (!c.nhom_con) {
      section.items.push(criterion);
      continue;
    }
    const [groupCode = ""] = c.nhom_con.split(" ");
    let group = section.items.find((i) => i.kind === "group" && i.code === groupCode) as (CriterionGroup & { criteria: Criterion[] }) | undefined;
    if (!group) section.items.push((group = { kind: "group", code: groupCode, name: c.nhom_con, points: Number(/\((\d+)đ\)/.exec(c.nhom_con)?.[1] ?? 0), criteria: [] }));
    group.criteria.push(criterion);
  }
  return { code: String(set.bo), name: set.ten_bo, totalPoints: set.tong_diem, parts };
}

const inSheetOrder = (set: CriteriaSet): Criterion[] =>
  set.parts.flatMap((p) => p.sections.flatMap((s) => s.items.flatMap((i) => (i.kind === "group" ? i.criteria : [i]))));

/** Every Tiêu chí of a set at its highest Mức điểm. */
export function topScores(set: CriteriaSet): Record<string, number> {
  return Object.fromEntries(inSheetOrder(set).map((c) => [c.code, c.maxPoints]));
}

/** Fills Tiêu chí in sheet order up to their maximum until the scores add up to `total`. */
export function scoresTotalling(set: CriteriaSet, total: number): Record<string, number> {
  const scores: Record<string, number> = {};
  let left = total;
  for (const c of inSheetOrder(set)) {
    const points = Math.min(c.maxPoints, left);
    scores[c.code] = points;
    left -= points;
  }
  return scores;
}
