import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { resultsWorld, TWO } from "./results-world";

/*
 * #14 permission matrix rows for the Thư kết quả không đạt (#85, L16 HD-10, CT-13; spec #79 stories 36 to 44, 66). Each row
 * runs against a fresh hồ sơ 2 sao Đã chốt điểm; "đính chính" and "tải thư" find one letter the Cán bộ Sở already issued.
 * Only the Cán bộ Sở soạn, xem trước and phát hành; the Chủ thể reads only the letter of its own hồ sơ.
 */

type Who = "Cán bộ Sở" | "Chủ tịch A" | "Thư ký A" | "Thành viên A" | "Tổ tư vấn A" | "Cán bộ xã" | "Chủ thể" | "Chủ thể khác" | "Quản trị";
type Action = "soạn thư" | "xem trước" | "phát hành" | "đính chính" | "tải thư";
type Outcome = "allowed" | "forbidden" | "not_found";

const WHO: Who[] = ["Cán bộ Sở", "Chủ tịch A", "Thư ký A", "Thành viên A", "Tổ tư vấn A", "Cán bộ xã", "Chủ thể", "Chủ thể khác", "Quản trị"];
const ACTIONS: Action[] = ["soạn thư", "xem trước", "phát hành", "đính chính", "tải thư"];

function outcomeOf(who: Who, action: Action): Outcome {
  if (who === "Cán bộ Sở") return "allowed";
  if (action !== "tải thư") return "forbidden";
  // Story 66: the Chủ thể downloads the letter of its own hồ sơ; another Chủ thể does not find it.
  if (who === "Chủ thể") return "allowed";
  if (who === "Chủ thể khác") return "not_found";
  return "forbidden";
}

const ROWS: [Who, Action, Outcome][] = WHO.flatMap((who) => ACTIONS.map((action): [Who, Action, Outcome] => [who, action, outcomeOf(who, action)]));

describe("Permission matrix: Thư kết quả không đạt (#85)", () => {
  const { w, closedMeeting, versionOf } = resultsWorld();
  const actors = {} as Record<Exclude<Who, "Chủ thể" | "Chủ thể khác">, UserActor>;
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

  const letterInput = async (dossierId: string, reason?: string) => ({
    dossierId,
    expectedVersion: await versionOf(dossierId),
    criterionIds: [w.criterionId("3.1")],
    advice: "Bổ sung chứng nhận chất lượng.",
    reason,
  });

  async function attempt(who: Who, action: Action) {
    const { dossiers } = await closedMeeting(who === "Chủ thể khác" ? [TWO, TWO] : [TWO]);
    const { dossierId, a } = dossiers[0]!;
    const actor = who === "Chủ thể" ? a : who === "Chủ thể khác" ? dossiers[1]!.a : actors[who];
    if (action === "đính chính" || action === "tải thư") await w.t.app.results.issueResultLetter(w.province, await letterInput(dossierId));
    switch (action) {
      case "soạn thư":
        return w.t.app.results.resultLetterDraft(actor, { dossierId });
      case "xem trước":
        return w.t.app.results.previewResultLetter(actor, await letterInput(dossierId));
      case "phát hành":
        return w.t.app.results.issueResultLetter(actor, await letterInput(dossierId));
      case "đính chính":
        return w.t.app.results.issueResultLetter(actor, await letterInput(dossierId, "Sửa lời khuyên"));
      case "tải thư":
        return w.t.app.results.downloadResultLetter(actor, { dossierId });
    }
  }

  it.each(ROWS)("%s — %s → %s", async (who, action, outcome) => {
    const run = attempt(who, action);
    if (outcome === "allowed") await expect(run).resolves.toBeDefined();
    else await expect(run).rejects.toMatchObject({ code: outcome });
  });
});
