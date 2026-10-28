import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { scoringWorld } from "../scoring/world";

/*
 * #14 permission matrix rows for Xuất Excel danh sách sản phẩm đạt sao (#91, L22 DC-05; spec #79 stories 83, 84): the
 * Cán bộ Sở alone, whatever else the others may export.
 */

type Who = "Cán bộ Sở" | "Cán bộ xã" | "Chủ tịch A" | "Thư ký A" | "Thành viên A" | "Tổ tư vấn A" | "Chủ thể" | "Quản trị";

const ROWS: [Who, "allowed" | "forbidden"][] = [
  // Story 83.
  ["Cán bộ Sở", "allowed"],
  // The danh sách hồ sơ is theirs to export (#90), not this one.
  ["Cán bộ xã", "forbidden"],
  ["Chủ tịch A", "forbidden"],
  ["Thư ký A", "forbidden"],
  // Story 84: no Xuất Excel at all.
  ["Thành viên A", "forbidden"],
  ["Tổ tư vấn A", "forbidden"],
  ["Chủ thể", "forbidden"],
  ["Quản trị", "forbidden"],
];

describe("Permission matrix: Xuất Excel danh sách sản phẩm đạt sao (#91)", () => {
  const w = scoringWorld({ minGraders: 2 });
  const actors = {} as Record<Who, UserActor>;
  beforeAll(async () => {
    const d = await w.graded([w.A.members[0]!, w.A.members[1]!]);
    Object.assign(actors, {
      "Cán bộ Sở": w.province,
      "Cán bộ xã": w.ward,
      "Chủ tịch A": w.A.chair,
      "Thư ký A": w.A.secretary,
      "Thành viên A": w.A.members[0]!,
      "Tổ tư vấn A": w.A.advisors[0]!,
      "Chủ thể": d.a,
      "Quản trị": await w.f.admin(),
    });
  });

  it.each(ROWS)("%s → %s", async (who, outcome) => {
    const run = w.t.app.results.exportStarList(actors[who], {});
    if (outcome === "forbidden") await expect(run).rejects.toMatchObject({ code: "forbidden" });
    else await expect(run).resolves.toMatchObject({ rowCount: 0 });
  });
});
