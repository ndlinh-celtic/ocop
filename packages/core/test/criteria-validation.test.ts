import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseQd26File } from "../src/criteria/qd26-file";
import { findVersionIssues } from "../src/criteria/validation";
import type { VersionRows } from "../src/criteria/version";

const QD26 = readFileSync(fileURLToPath(new URL("../../../docs/tieu-chi/ocop_tieu_chi_qd26_2026.json", import.meta.url)), "utf8");

/** The rows of the real QĐ 26 file, freshly parsed so each test can break them its own way. */
function qd26Rows(): VersionRows {
  let n = 0;
  return parseQd26File(QD26, () => `id-${++n}`).rows;
}

const setNo = (rows: VersionRows, code: string) => rows.sets.find((s) => s.set.code === code)!;
const criterionOf = (rows: VersionRows, setCode: string, code: string) => setNo(rows, setCode).criteria.find((c) => c.code === code)!;

describe("L19 AD-04 kiểm tra Phiên bản tiêu chí", () => {
  it("finds nothing wrong with QĐ 26 as imported", () => {
    expect(findVersionIssues(qd26Rows())).toEqual([]);
  });

  it("reports a Tiêu chí whose điểm tối đa is not its highest Mức điểm", () => {
    const rows = qd26Rows();
    criterionOf(rows, "1", "1.5").maxPoints = 4;
    expect(findVersionIssues(rows)).toContainEqual(
      expect.objectContaining({ code: "max_points_mismatch", setCode: "1", criterionCode: "1.5", setId: setNo(rows, "1").set.id }),
    );
  });

  it("reports a Nhóm tiêu chí whose points are not the sum of its Tiêu chí", () => {
    const rows = qd26Rows();
    const set = rows.sets.find((s) => s.criterionGroups.length > 0)!;
    const group = set.criterionGroups[0]!;
    group.points += 1;
    expect(findVersionIssues(rows)).toEqual([
      expect.objectContaining({ code: "group_points_mismatch", setCode: set.set.code, message: expect.stringContaining(`Nhóm tiêu chí ${group.code}`) }),
      // The Mục still adds up its items' declared points, so it no longer matches either.
      expect.objectContaining({ code: "section_points_mismatch", setCode: set.set.code }),
    ]);
  });

  it("reports a Mục whose points are not the sum of its Tiêu chí", () => {
    const rows = qd26Rows();
    const set1 = setNo(rows, "1");
    // Tiêu chí 1.5 and its top Mức điểm both lose a point: the criterion is consistent, its Mục (18 điểm) is not.
    const c = criterionOf(rows, "1", "1.5");
    c.maxPoints -= 1;
    set1.levels.filter((l) => l.criterionId === c.id).sort((a, b) => b.points - a.points)[0]!.points -= 1;
    expect(findVersionIssues(rows)).toEqual([
      {
        code: "section_points_mismatch",
        setId: set1.set.id,
        setCode: "1",
        criterionCode: null,
        message: "Mục 1 (Phần A): khai báo 18 điểm, tổng các thành phần là 17",
      },
    ]);
  });

  it("reports a Phần whose points are not the sum of its Mục, and a Bộ tiêu chí whose total is not the sum of its Phần", () => {
    const rows = qd26Rows();
    const set1 = setNo(rows, "1");
    set1.parts.find((p) => p.code === "A")!.points = 41;
    expect(findVersionIssues(rows).map((i) => [i.code, i.setCode, i.message])).toEqual([
      ["part_points_mismatch", "1", "Phần A: khai báo 41 điểm, tổng các Mục là 40"],
      ["set_total_mismatch", "1", "Tổng điểm bộ: khai báo 100 điểm, tổng các Phần là 101"],
    ]);
  });

  it("reports a mã tiêu chí used twice in one Bộ tiêu chí, but not the same code in two Bộ", () => {
    const rows = qd26Rows();
    criterionOf(rows, "1", "1.5").code = "1.4";
    expect(findVersionIssues(rows)).toEqual([
      expect.objectContaining({ code: "duplicate_criterion_code", setCode: "1", criterionCode: "1.4", message: "Mã tiêu chí 1.4 xuất hiện 2 lần trong bộ" }),
    ]);
  });

  it("reports names repeated at one level of the Cây phân loại", () => {
    const rows = qd26Rows();
    const [g1, g2] = rows.productGroups;
    g2!.name = g1!.name;
    const subgroups = rows.subgroups.filter((s) => s.productGroupId === g1!.id);
    expect(subgroups.length).toBeGreaterThan(1);
    subgroups[1]!.name = subgroups[0]!.name;
    const sets = rows.sets.filter((s) => s.set.subgroupId === subgroups[0]!.id);
    expect(sets.length).toBeGreaterThan(1);
    sets[1]!.set.name = sets[0]!.set.name;
    expect(findVersionIssues(rows).map((i) => [i.code, i.setCode, i.message])).toEqual([
      ["duplicate_name", null, `Tên Nhóm sản phẩm "${g1!.name}" bị trùng`],
      ["duplicate_name", null, `Tên Phân nhóm "${subgroups[0]!.name}" bị trùng trong Nhóm sản phẩm "${g1!.name}"`],
      ["duplicate_name", sets[1]!.set.code, `Tên Bộ tiêu chí "${sets[0]!.set.name}" bị trùng trong Phân nhóm "${subgroups[0]!.name}"`],
    ]);
  });

  it("accepts the same name at different levels or under different parents", () => {
    const rows = qd26Rows();
    // QĐ 26 itself puts a Bộ with an empty `nhom` in a Phân nhóm of the Bộ's name.
    rows.subgroups[0]!.name = rows.productGroups[1]!.name;
    expect(findVersionIssues(rows)).toEqual([]);
  });

  it.each([
    ["equal", { 2: 30, 3: 50, 4: 50, 5: 90 }],
    ["decreasing", { 2: 30, 3: 70, 4: 50, 5: 90 }],
  ])("reports Ngưỡng hạng that are not increasing (%s)", (_, thresholds) => {
    const rows = qd26Rows();
    rows.thresholds = thresholds;
    expect(findVersionIssues(rows)).toEqual([
      { code: "thresholds_not_increasing", setId: null, setCode: null, criterionCode: null, message: "Ngưỡng 4 sao phải lớn hơn ngưỡng 3 sao" },
    ]);
  });

  it("reports a Ngưỡng hạng above the total of a Bộ tiêu chí", () => {
    const rows = qd26Rows();
    rows.thresholds = { 2: 30, 3: 50, 4: 70, 5: 100.5 };
    const issues = findVersionIssues(rows);
    expect(issues).toHaveLength(26);
    expect(issues[0]).toEqual({
      code: "threshold_exceeds_total",
      setId: rows.sets[0]!.set.id,
      setCode: rows.sets[0]!.set.code,
      criterionCode: null,
      message: "Ngưỡng 5 sao (100.5 điểm) vượt tổng điểm bộ (100 điểm)",
    });
  });

  it("reports every problem at once", () => {
    const rows = qd26Rows();
    criterionOf(rows, "1", "1.5").maxPoints = 4;
    criterionOf(rows, "26", "1.1").code = "1.2";
    rows.thresholds = { 2: 30, 3: 30, 4: 70, 5: 90 };
    expect(findVersionIssues(rows).map((i) => i.code)).toEqual([
      "thresholds_not_increasing",
      "max_points_mismatch",
      "section_points_mismatch",
      "duplicate_criterion_code",
    ]);
  });
});
