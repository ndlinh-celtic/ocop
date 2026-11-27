import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { FIVE, resultsWorld } from "./results-world";

/*
 * #14 permission matrix rows for Đề xuất 5 sao (#87, L17 SO-04; spec #79 stories 46, 53, 54, 58, 59). Each row runs on a
 * fresh hồ sơ 5 sao Công bố (Đã chốt điểm), or Đã gửi đề nghị 5 sao for chuyển về and đóng; the Bộ's văn bản is the Cán bộ
 * Sở's own upload. The Cán bộ Sở alone may do any of it.
 */

type Who = "Cán bộ Sở" | "Chủ tịch A" | "Thư ký A" | "Thành viên A" | "Tổ tư vấn A" | "Cán bộ xã" | "Chủ thể" | "Quản trị";
type Action = "danh sách Đề xuất 5 sao" | "đánh dấu đã gửi" | "chuyển về công nhận cấp tỉnh" | "đóng hồ sơ" | "tải lên văn bản của Bộ" | "tải văn bản của Bộ";
type Outcome = "allowed" | "forbidden";

const WHO: Who[] = ["Cán bộ Sở", "Chủ tịch A", "Thư ký A", "Thành viên A", "Tổ tư vấn A", "Cán bộ xã", "Chủ thể", "Quản trị"];
const ACTIONS: Action[] = [
  "danh sách Đề xuất 5 sao",
  "đánh dấu đã gửi",
  "chuyển về công nhận cấp tỉnh",
  "đóng hồ sơ",
  "tải lên văn bản của Bộ",
  "tải văn bản của Bộ",
];
const ROWS: [Who, Action, Outcome][] = WHO.flatMap((who) =>
  ACTIONS.map((action): [Who, Action, Outcome] => [who, action, who === "Cán bộ Sở" ? "allowed" : "forbidden"]),
);

describe("Permission matrix: Đề xuất 5 sao (#87)", () => {
  const { w, closedMeeting, record } = resultsWorld();
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
  const ministryFile = () => w.f.uploadPdf(w.province, "ministry_document", "Văn bản của Bộ.pdf");

  async function attempt(who: Who, action: Action) {
    const { meetingId, dossiers } = await closedMeeting([FIVE]);
    await record(meetingId);
    const { dossierId, a } = dossiers[0]!;
    const actor = who === "Chủ thể" ? a : actors[who];
    const sent = async () => {
      await w.t.app.results.markFiveStarSent(w.province, {
        dossierId,
        expectedVersion: await versionOf(dossierId),
        dispatchNumber: "45/SNNMT",
        sentOn: "2026-10-19",
      });
      return versionOf(dossierId);
    };
    switch (action) {
      case "danh sách Đề xuất 5 sao":
        return w.t.app.results.fiveStarList(actor);
      case "đánh dấu đã gửi":
        return w.t.app.results.markFiveStarSent(actor, {
          dossierId,
          expectedVersion: await versionOf(dossierId),
          dispatchNumber: "45/SNNMT",
          sentOn: "2026-10-19",
        });
      case "chuyển về công nhận cấp tỉnh": {
        const expectedVersion = await sent();
        return w.t.app.results.returnFiveStarToProvince(actor, { dossierId, expectedVersion, fileId: await ministryFile() });
      }
      case "đóng hồ sơ": {
        const expectedVersion = await sent();
        return w.t.app.results.closeFiveStar(actor, { dossierId, expectedVersion, outcome: "other", fileId: await ministryFile() });
      }
      case "tải lên văn bản của Bộ":
        return w.t.app.files.requestUpload(actor, { purpose: "ministry_document", fileName: "VB Bộ.pdf", contentType: "application/pdf", size: 1000 });
      case "tải văn bản của Bộ": {
        const fileId = await ministryFile();
        await w.t.app.results.returnFiveStarToProvince(w.province, { dossierId, expectedVersion: await sent(), fileId });
        return w.t.app.results.downloadMinistryDocument(actor, { dossierId, fileId });
      }
    }
  }

  it.each(ROWS)("%s — %s → %s", async (who, action, outcome) => {
    const run = attempt(who, action);
    if (outcome === "allowed") await expect(run).resolves.toBeDefined();
    else await expect(run).rejects.toMatchObject({ code: outcome });
  });
});
