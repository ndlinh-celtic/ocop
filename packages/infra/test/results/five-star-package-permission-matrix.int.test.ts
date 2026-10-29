import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { FIVE, resultsWorld } from "./results-world";

/*
 * #14 permission matrix rows for the Gói đề nghị 5 sao (#89, L17 SO-04; spec #79 stories 47 to 52). One hồ sơ 5 sao
 * Công bố and one ready package serve every row. The Cán bộ Sở alone may export, list and download.
 */

type Who = "Cán bộ Sở" | "Chủ tịch A" | "Thư ký A" | "Thành viên A" | "Tổ tư vấn A" | "Cán bộ xã" | "Chủ thể" | "Quản trị";
type Action = "xuất gói" | "danh sách gói đã xuất" | "tải gói";
type Outcome = "allowed" | "forbidden";

const WHO: Who[] = ["Cán bộ Sở", "Chủ tịch A", "Thư ký A", "Thành viên A", "Tổ tư vấn A", "Cán bộ xã", "Chủ thể", "Quản trị"];
const ACTIONS: Action[] = ["xuất gói", "danh sách gói đã xuất", "tải gói"];
const ROWS: [Who, Action, Outcome][] = WHO.flatMap((who) =>
  ACTIONS.map((action): [Who, Action, Outcome] => [who, action, who === "Cán bộ Sở" ? "allowed" : "forbidden"]),
);

describe("Permission matrix: Gói đề nghị 5 sao (#89)", () => {
  const { w, closedMeeting, record } = resultsWorld();
  const actors = {} as Record<Who, UserActor>;
  let dossierId: string;
  let packageId: string;

  beforeAll(async () => {
    const { meetingId, dossiers } = await closedMeeting([FIVE]);
    await record(meetingId);
    dossierId = dossiers[0]!.dossierId;
    ({ packageId } = await w.t.app.results.requestFiveStarPackage(w.province, { dossierIds: [dossierId] }));
    await w.t.drainJobs();
    Object.assign(actors, {
      "Cán bộ Sở": w.province,
      "Chủ tịch A": w.A.chair,
      "Thư ký A": w.A.secretary,
      "Thành viên A": w.A.members[0]!,
      "Tổ tư vấn A": w.A.advisors[0]!,
      "Cán bộ xã": w.ward,
      "Chủ thể": dossiers[0]!.a,
      "Quản trị": await w.f.admin(),
    });
  });

  function attempt(who: Who, action: Action) {
    const actor = actors[who];
    switch (action) {
      case "xuất gói":
        return w.t.app.results.requestFiveStarPackage(actor, { dossierIds: [dossierId] });
      case "danh sách gói đã xuất":
        return w.t.app.results.fiveStarPackages(actor);
      case "tải gói":
        return w.t.app.results.downloadFiveStarPackage(actor, { packageId });
    }
  }

  it.each(ROWS)("%s — %s → %s", async (who, action, outcome) => {
    const run = attempt(who, action);
    if (outcome === "allowed") await expect(run).resolves.toBeDefined();
    else await expect(run).rejects.toMatchObject({ code: outcome });
  });
});
