import { describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { scoringWorld } from "../scoring/world";

/*
 * #14 permission matrix rows for thay and bổ sung thành viên after Giao chấm (#55, L09 HD-03; spec #49 stories 34
 * to 39): `dossier.assignment.replace` is a same-state row for the Thư ký hội đồng from Tổ tư vấn thẩm định to
 * Sẵn sàng chốt, and nobody else's. The đợt is dựa trên Tổ tư vấn with 1 người chấm tối thiểu; every hồ sơ is
 * Phân công to Thành viên A 0 and 2 and Tổ tư vấn A 0 (Tổ trưởng), and reaches its state through the use cases:
 * phát hành, sao chép, Thành viên A 2 xác nhận (Sẵn sàng chốt), chốt (Thành viên A 0 Vắng). Thay replaces Thành viên
 * A 0 by Thành viên A 1; bổ sung adds Thành viên A 1. Hội đồng B is gán to no đợt.
 */

type Who = "Thư ký A" | "Chủ tịch A" | "Thành viên A, có Phân công" | "Tổ tư vấn A, có Phân công" | "Thư ký B" | "Quản trị" | "Cán bộ Sở" | "Chủ thể";
type Action = "thay" | "bổ sung";
type State = "Đã chuyển tỉnh" | "Tổ tư vấn thẩm định" | "Tổ tư vấn đã phát hành" | "Thành viên xem xét" | "Sẵn sàng chốt" | "Đã chốt điểm";
type Outcome = "allowed" | "not_found" | "forbidden" | "invalid_state";

const STATES: State[] = ["Đã chuyển tỉnh", "Tổ tư vấn thẩm định", "Tổ tư vấn đã phát hành", "Thành viên xem xét", "Sẵn sàng chốt", "Đã chốt điểm"];
const IN_FORCE: State[] = ["Tổ tư vấn thẩm định", "Tổ tư vấn đã phát hành", "Thành viên xem xét", "Sẵn sàng chốt"];
const OUTCOMES: Record<Who, (s: State) => Outcome> = {
  "Thư ký A": (s) => (IN_FORCE.includes(s) ? "allowed" : "invalid_state"),
  // Not a Vai trò that changes a hồ sơ at all (dossier.write).
  "Chủ tịch A": () => "forbidden",
  "Thành viên A, có Phân công": () => "forbidden",
  "Tổ tư vấn A, có Phân công": () => "forbidden",
  "Quản trị": () => "forbidden",
  // Not the Hội đồng of the đợt.
  "Thư ký B": () => "not_found",
  // In their Phạm vi, but the row is not theirs.
  "Cán bộ Sở": () => "forbidden",
  "Chủ thể": () => "forbidden",
};
const MATRIX: [Who, Action, State, Outcome][] = (Object.keys(OUTCOMES) as Who[]).flatMap((who) =>
  (["thay", "bổ sung"] as const).flatMap((action) => STATES.map((s): [Who, Action, State, Outcome] => [who, action, s, OUTCOMES[who](s)])),
);

describe("#14 permission matrix: thay và bổ sung thành viên sau Giao chấm (#55)", () => {
  const w = scoringWorld({ gradingMode: "advisory_based", minGraders: 1, advisors: 2 });
  const m = (i: number) => w.A.members[i]!;
  const versionOf = async (dossierId: string) => (await w.t.app.dossiers.get(w.A.secretary, { dossierId })).version;

  /** A fresh hồ sơ in `state`, reached through the use cases. */
  async function dossierIn(state: State): Promise<{ owner: UserActor; dossierId: string }> {
    if (state === "Đã chuyển tỉnh") {
      const s = await w.f.provinceReceived(w.ward, w.province, w.setId);
      await w.t.app.councils.editAssignments(w.A.secretary, { dossiers: [{ dossierId: s.dossierId, expectedVersion: s.version }], members: [m(0).userId], advisors: [w.A.advisors[0]!.userId] });
      return { owner: s.a, dossierId: s.dossierId };
    }
    const people = { members: [m(0), m(2)], advisors: [w.A.advisors[0]!] };
    if (state === "Tổ tư vấn thẩm định") {
      const d = await w.graded(people.members, people.advisors);
      return { owner: d.a, dossierId: d.dossierId };
    }
    const issued = state === "Tổ tư vấn đã phát hành";
    const d = await (issued ? w.f.advisoryIssued : w.f.advisoryCopied)(w.ward, w.province, w.setId, w.A.secretary, people);
    if (issued || state === "Thành viên xem xét") return { owner: d.a, dossierId: d.dossierId };
    const own = await w.t.app.scoring.readDossierScores(m(2), { dossierId: d.dossierId, ownSheet: true });
    if (own.kind !== "own_sheet") throw new Error(own.kind);
    await w.t.app.scoring.confirmScoreSheet(m(2), { dossierId: d.dossierId, expectedVersion: own.sheet!.version });
    if (state === "Đã chốt điểm") {
      await w.t.app.scoring.createMeeting(w.A.secretary, { roundId: w.roundId, title: "Phiên họp", heldOn: "2026-10-25", location: "Sở", dossierIds: [d.dossierId] });
      await w.t.app.scoring.finalize(w.A.secretary, { dossierId: d.dossierId, expectedVersion: await versionOf(d.dossierId) });
    }
    return { owner: d.a, dossierId: d.dossierId };
  }

  function actorOf(who: Who, owner: UserActor): UserActor {
    switch (who) {
      case "Thư ký A":
        return w.A.secretary;
      case "Chủ tịch A":
        return w.A.chair;
      case "Thành viên A, có Phân công":
        return m(0);
      case "Tổ tư vấn A, có Phân công":
        return w.A.advisors[0]!;
      case "Thư ký B":
        return w.B.secretary;
      case "Quản trị":
        throw new Error("signed in separately");
      case "Cán bộ Sở":
        return w.province;
      case "Chủ thể":
        return owner;
    }
  }

  it.each(MATRIX)("%s / %s / %s → %s", async (who, action, state, outcome) => {
    const { owner, dossierId } = await dossierIn(state);
    const actor = who === "Quản trị" ? await w.f.admin() : actorOf(who, owner);
    const expectedVersion = await versionOf(dossierId);
    const reason = "Xung đột lợi ích";
    const attempt =
      action === "thay"
        ? w.t.app.councils.replaceAssignment(actor, { dossierId, expectedVersion, userId: m(0).userId, newUserId: m(1).userId, reason })
        : w.t.app.councils.addAssignment(actor, { dossierId, expectedVersion, userId: m(1).userId, kind: "member", reason });
    if (outcome === "allowed") await expect(attempt).resolves.toMatchObject({ version: expectedVersion + 1 });
    else await expect(attempt).rejects.toMatchObject({ code: outcome });
  });
});
