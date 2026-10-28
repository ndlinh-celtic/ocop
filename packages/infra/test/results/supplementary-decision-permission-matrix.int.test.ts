import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { FIVE, resultsWorld } from "./results-world";

/*
 * #14 permission matrix rows for the Quyết định công nhận bổ sung (#88; spec #79 stories 56, 57; ADR 0009). Each row runs
 * on a fresh hồ sơ 5 sao Đã gửi đề nghị 5 sao that the Bộ trả về (cờ chờ); the signed PDF is the Cán bộ Sở's own upload.
 * The Cán bộ Sở alone may sinh the dự thảo, ghi nhận the quyết định or list them.
 */

type Who = "Cán bộ Sở" | "Chủ tịch A" | "Thư ký A" | "Thành viên A" | "Tổ tư vấn A" | "Cán bộ xã" | "Chủ thể" | "Quản trị";
type Action = "dự thảo quyết định bổ sung" | "ghi nhận quyết định bổ sung" | "danh sách quyết định bổ sung";
type Outcome = "allowed" | "forbidden";

const WHO: Who[] = ["Cán bộ Sở", "Chủ tịch A", "Thư ký A", "Thành viên A", "Tổ tư vấn A", "Cán bộ xã", "Chủ thể", "Quản trị"];
const ACTIONS: Action[] = ["dự thảo quyết định bổ sung", "ghi nhận quyết định bổ sung", "danh sách quyết định bổ sung"];
const ROWS: [Who, Action, Outcome][] = WHO.flatMap((who) =>
  ACTIONS.map((action): [Who, Action, Outcome] => [who, action, who === "Cán bộ Sở" ? "allowed" : "forbidden"]),
);

describe("Permission matrix: Quyết định công nhận bổ sung (#88)", () => {
  const { w, closedMeeting, record, decisionFile } = resultsWorld();
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

  const versionOf = async (dossierId: string) => (await w.t.app.dossiers.get(w.province, { dossierId })).version;

  /** A hồ sơ 5 sao chờ Quyết định công nhận bổ sung. */
  async function waiting() {
    const { meetingId, dossiers } = await closedMeeting([FIVE]);
    await record(meetingId);
    const { dossierId, a } = dossiers[0]!;
    const { version } = await w.t.app.results.markFiveStarSent(w.province, {
      dossierId,
      expectedVersion: await versionOf(dossierId),
      dispatchNumber: "45/SNNMT",
      sentOn: "2026-10-19",
    });
    await w.t.app.results.returnFiveStarToProvince(w.province, {
      dossierId,
      expectedVersion: version,
      fileId: await w.f.uploadPdf(w.province, "ministry_document", "Văn bản của Bộ.pdf"),
    });
    return { dossierId, a };
  }

  async function attempt(who: Who, action: Action) {
    const { dossierId, a } = await waiting();
    const actor = who === "Chủ thể" ? a : actors[who];
    switch (action) {
      case "dự thảo quyết định bổ sung":
        return w.t.app.results.supplementaryDecisionDraft(actor, { dossierIds: [dossierId] });
      case "ghi nhận quyết định bổ sung":
        return w.t.app.results.recordSupplementaryDecision(actor, {
          dossierIds: [dossierId],
          number: "456/QĐ-UBND",
          signedOn: "2026-10-19",
          fileId: await decisionFile(),
        });
      case "danh sách quyết định bổ sung":
        return w.t.app.results.supplementaryDecisions(actor);
    }
  }

  it.each(ROWS)("%s — %s → %s", async (who, action, outcome) => {
    const run = attempt(who, action);
    if (outcome === "allowed") await expect(run).resolves.toBeDefined();
    else await expect(run).rejects.toMatchObject({ code: outcome });
  });
});
