import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { scoringWorld } from "./world";

/*
 * #14 permission matrix rows for văn bản họp and biên bản đã ký (#62, L15 HD-09, TM-11; spec #49 stories 64, 110 to
 * 115, 132). Each row gets a fresh Phiên họp of Hội đồng A, open or kết thúc. The Chủ tịch and Thư ký sinh and read
 * văn bản họp; only the Thư ký tải lên the biên bản đã ký; another Hội đồng sees no Phiên họp of A.
 */

type Who =
  | "Chủ tịch A"
  | "Thư ký A"
  | "Thành viên A"
  | "Tổ tư vấn A"
  | "Chủ tịch B"
  | "Thư ký B"
  | "Cán bộ Sở"
  | "Cán bộ xã"
  | "Chủ thể"
  | "Quản trị";
type State = "Phiên họp mở" | "Phiên họp đã kết thúc";
type Action = "sinh văn bản" | "tải lên biên bản" | "tải xuống biên bản";
type Outcome = "allowed" | "not_found" | "forbidden";

const ROWS: [Who, Action, State, Outcome][] = [
  // Stories 110 to 113: the Chủ tịch and Thư ký of the Hội đồng, at any time, also to sinh lại after kết thúc.
  ["Chủ tịch A", "sinh văn bản", "Phiên họp mở", "allowed"],
  ["Thư ký A", "sinh văn bản", "Phiên họp mở", "allowed"],
  ["Thư ký A", "sinh văn bản", "Phiên họp đã kết thúc", "allowed"],
  ["Chủ tịch B", "sinh văn bản", "Phiên họp mở", "not_found"],
  ["Thư ký B", "sinh văn bản", "Phiên họp mở", "not_found"],
  // Story 64: the Tổ tư vấn does not prepare the quyết định công nhận; nor a thành viên, the Sở, the xã, the Chủ thể, Quản trị.
  ["Thành viên A", "sinh văn bản", "Phiên họp mở", "forbidden"],
  ["Tổ tư vấn A", "sinh văn bản", "Phiên họp mở", "forbidden"],
  ["Cán bộ Sở", "sinh văn bản", "Phiên họp mở", "forbidden"],
  ["Cán bộ xã", "sinh văn bản", "Phiên họp mở", "forbidden"],
  ["Chủ thể", "sinh văn bản", "Phiên họp mở", "forbidden"],
  ["Quản trị", "sinh văn bản", "Phiên họp mở", "forbidden"],

  // Story 115: the Thư ký, open or kết thúc (a biên bản is signed after the họp).
  ["Thư ký A", "tải lên biên bản", "Phiên họp mở", "allowed"],
  ["Thư ký A", "tải lên biên bản", "Phiên họp đã kết thúc", "allowed"],
  ["Thư ký B", "tải lên biên bản", "Phiên họp mở", "not_found"],
  ["Chủ tịch A", "tải lên biên bản", "Phiên họp mở", "forbidden"],
  ["Thành viên A", "tải lên biên bản", "Phiên họp mở", "forbidden"],
  ["Tổ tư vấn A", "tải lên biên bản", "Phiên họp mở", "forbidden"],
  ["Cán bộ Sở", "tải lên biên bản", "Phiên họp mở", "forbidden"],
  ["Quản trị", "tải lên biên bản", "Phiên họp mở", "forbidden"],

  ["Chủ tịch A", "tải xuống biên bản", "Phiên họp đã kết thúc", "allowed"],
  ["Thư ký A", "tải xuống biên bản", "Phiên họp đã kết thúc", "allowed"],
  ["Thư ký B", "tải xuống biên bản", "Phiên họp đã kết thúc", "not_found"],
  ["Thành viên A", "tải xuống biên bản", "Phiên họp đã kết thúc", "forbidden"],
  ["Tổ tư vấn A", "tải xuống biên bản", "Phiên họp đã kết thúc", "forbidden"],
  ["Cán bộ Sở", "tải xuống biên bản", "Phiên họp đã kết thúc", "forbidden"],
  ["Chủ thể", "tải xuống biên bản", "Phiên họp đã kết thúc", "forbidden"],
  ["Quản trị", "tải xuống biên bản", "Phiên họp đã kết thúc", "forbidden"],
];

describe("Permission matrix: văn bản họp and biên bản đã ký (#62)", () => {
  const w = scoringWorld({ minGraders: 2 });
  const actors = {} as Record<Who, UserActor>;
  beforeAll(async () => {
    Object.assign(actors, {
      "Chủ tịch A": w.A.chair,
      "Thư ký A": w.A.secretary,
      "Thành viên A": w.A.members[0]!,
      "Tổ tư vấn A": w.A.advisors[0]!,
      "Chủ tịch B": w.B.chair,
      "Thư ký B": w.B.secretary,
      "Cán bộ Sở": w.province,
      "Cán bộ xã": w.ward,
      "Chủ thể": await w.f.owner(),
      "Quản trị": await w.f.admin(),
    });
  });

  async function meetingIn(state: State) {
    const { meetingId } = await w.t.app.scoring.createMeeting(w.A.secretary, { roundId: w.roundId, title: "Phiên họp", heldOn: "2026-10-25", location: "Sở", dossierIds: [] });
    await w.t.app.scoring.attachMeetingMinutes(w.A.secretary, { meetingId, fileId: await w.f.uploadPdf(w.A.secretary, "meeting_minutes") });
    if (state === "Phiên họp đã kết thúc") await w.t.app.scoring.closeMeeting(w.A.secretary, { meetingId });
    return meetingId;
  }

  async function attempt(who: Who, action: Action, meetingId: string): Promise<Outcome> {
    const actor = actors[who];
    switch (action) {
      case "sinh văn bản":
        await w.t.app.scoring.generateMeetingDocument(actor, { meetingId, kind: "decision" });
        return "allowed";
      case "tải lên biên bản":
        await w.t.app.scoring.attachMeetingMinutes(actor, { meetingId, fileId: await w.f.uploadPdf(actor, "meeting_minutes") });
        return "allowed";
      case "tải xuống biên bản":
        await w.t.app.scoring.downloadMeetingMinutes(actor, { meetingId, number: 1 });
        return "allowed";
    }
  }

  it.each(ROWS)("%s / %s / %s → %s", async (who, action, state, outcome) => {
    const meetingId = await meetingIn(state);
    const run = attempt(who, action, meetingId);
    if (outcome === "allowed") await expect(run).resolves.toBe(outcome);
    else await expect(run).rejects.toMatchObject({ code: outcome });
  });
});
