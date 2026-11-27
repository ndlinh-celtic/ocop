import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { resultsWorld, THREE } from "./results-world";

/*
 * #14 permission matrix rows for the Quyết định công nhận (#83, L16 HD-11; spec #79 stories 9, 21). Each row runs against
 * a fresh closed Phiên họp of Hội đồng A with one hồ sơ 3 sao chốt; the signed PDF is the Cán bộ Sở's own upload.
 */

type Who = "Cán bộ Sở" | "Chủ tịch A" | "Thư ký A" | "Thành viên A" | "Tổ tư vấn A" | "Cán bộ xã" | "Chủ thể" | "Quản trị";
type Action = "ghi nhận quyết định" | "xem Phiên họp" | "danh sách Phiên họp" | "tải lên tệp quyết định";
type Outcome = "allowed" | "forbidden";

const WHO: Who[] = ["Cán bộ Sở", "Chủ tịch A", "Thư ký A", "Thành viên A", "Tổ tư vấn A", "Cán bộ xã", "Chủ thể", "Quản trị"];
const ACTIONS: Action[] = ["ghi nhận quyết định", "xem Phiên họp", "danh sách Phiên họp", "tải lên tệp quyết định"];
// Story 21: the Cán bộ Sở alone, for every action.
const ROWS: [Who, Action, Outcome][] = WHO.flatMap((who) =>
  ACTIONS.map((action): [Who, Action, Outcome] => [who, action, who === "Cán bộ Sở" ? "allowed" : "forbidden"]),
);

describe("Permission matrix: Quyết định công nhận (#83)", () => {
  const { w, closedMeeting, decisionFile } = resultsWorld();
  const actors = {} as Record<Exclude<Who, "Chủ thể">, UserActor>;
  beforeAll(async () => {
    Object.assign(actors, {
      "Cán bộ Sở": w.province,
      "Chủ tịch A": w.A.chair,
      "Thư ký A": w.A.secretary,
      "Thành viên A": w.A.members[0]!,
      "Tổ tư vấn A": w.A.advisors[0]!,
      "Cán bộ xã": w.ward,
      "Quản trị": await w.f.admin(),
    });
  });

  async function attempt(who: Who, action: Action) {
    const { meetingId, dossiers } = await closedMeeting([THREE]);
    const actor = who === "Chủ thể" ? dossiers[0]!.a : actors[who];
    switch (action) {
      case "ghi nhận quyết định":
        return w.t.app.results.recordMeetingDecision(actor, { meetingId, number: "1/QĐ-UBND", signedOn: "2026-10-19", fileId: await decisionFile() });
      case "xem Phiên họp":
        return w.t.app.results.meetingDecision(actor, { meetingId });
      case "danh sách Phiên họp":
        return w.t.app.results.meetingsForDecision(actor);
      case "tải lên tệp quyết định":
        return w.t.app.files.requestUpload(actor, { purpose: "recognition_decision", fileName: "QĐ.pdf", contentType: "application/pdf", size: 1000 });
    }
  }

  it.each(ROWS)("%s — %s → %s", async (who, action, outcome) => {
    const run = attempt(who, action);
    if (outcome === "allowed") await expect(run).resolves.toBeDefined();
    else await expect(run).rejects.toMatchObject({ code: outcome });
  });
});
