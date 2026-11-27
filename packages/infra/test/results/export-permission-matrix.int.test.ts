import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { scoringWorld } from "../scoring/world";

/*
 * #14 permission matrix rows for Xuất Excel danh sách hồ sơ (#90, L22 DC-05; spec #79 stories 80 to 84). The hồ sơ is
 * Giao chấm to thành viên M0 and M1 of Hội đồng A in the xã of the world's Cán bộ xã. "includes" means the export has
 * the hồ sơ's row, "excludes" that it succeeds without it.
 */

type Who = "Cán bộ xã" | "Cán bộ Sở" | "Chủ tịch A" | "Thư ký A" | "Chủ tịch B" | "Thư ký B" | "Thành viên A, chấm" | "Tổ tư vấn A" | "Chủ thể" | "Quản trị";
type Outcome = "includes" | "excludes" | "forbidden";

const ROWS: [Who, Outcome][] = [
  // Stories 80 to 82: the Cán bộ xã, Cán bộ Sở, Chủ tịch and Thư ký, each within their Phạm vi.
  ["Cán bộ xã", "includes"],
  ["Cán bộ Sở", "includes"],
  ["Chủ tịch A", "includes"],
  ["Thư ký A", "includes"],
  ["Chủ tịch B", "excludes"],
  ["Thư ký B", "excludes"],
  // Story 84: no Xuất Excel for the Chủ thể, a Thành viên hội đồng or the Tổ tư vấn; nor the Quản trị.
  ["Thành viên A, chấm", "forbidden"],
  ["Tổ tư vấn A", "forbidden"],
  ["Chủ thể", "forbidden"],
  ["Quản trị", "forbidden"],
];

describe("Permission matrix: Xuất Excel danh sách hồ sơ (#90)", () => {
  const w = scoringWorld({ minGraders: 2 });
  const actors = {} as Record<Exclude<Who, "Chủ thể">, UserActor>;
  let d: { a: UserActor; dossierId: string };
  beforeAll(async () => {
    d = await w.graded([w.A.members[0]!, w.A.members[1]!]);
    Object.assign(actors, {
      "Cán bộ xã": w.ward,
      "Cán bộ Sở": w.province,
      "Chủ tịch A": w.A.chair,
      "Thư ký A": w.A.secretary,
      "Chủ tịch B": w.B.chair,
      "Thư ký B": w.B.secretary,
      "Thành viên A, chấm": w.A.members[0]!,
      "Tổ tư vấn A": w.A.advisors[0]!,
      "Quản trị": await w.f.admin(),
    });
  });

  async function attempt(who: Who): Promise<Outcome> {
    const actor = who === "Chủ thể" ? d.a : actors[who];
    const { code } = await w.t.app.dossiers.get(w.province, { dossierId: d.dossierId });
    const file = await w.t.app.dossiers.exportDossiers(actor, {});
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(file.bytes) as unknown as ArrayBuffer);
    const codes = book.worksheets[0]!.getColumn(1).values.slice(2);
    return codes.includes(code) ? "includes" : "excludes";
  }

  it.each(ROWS)("%s → %s", async (who, outcome) => {
    const run = attempt(who);
    if (outcome === "forbidden") await expect(run).rejects.toMatchObject({ code: "forbidden" });
    else await expect(run).resolves.toBe(outcome);
  });
});
