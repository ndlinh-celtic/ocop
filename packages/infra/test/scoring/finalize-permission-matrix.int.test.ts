import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { scoringWorld } from "./world";

/*
 * #14 permission matrix rows for Phiên họp and chốt điểm (#60, L15 HD-08, HD-09, TV-08; spec #49 stories 64, 107,
 * 116, 117, 122 to 125, 132). Each hồ sơ is Giao chấm (chấm trực tiếp) to thành viên M0, M1 and M2 of Hội đồng A; the
 * đợt needs 2 phiếu đã xác nhận. "Thành viên xem xét" is M0 confirmed; "Sẵn sàng chốt" is M0 and M1 confirmed;
 * "Đã chốt điểm" is that hồ sơ chốt by the Thư ký A in a Phiên họp, M2 Vắng. M3 has no Phân công.
 */

type Who =
  | "Chủ tịch A"
  | "Thư ký A"
  | "Thành viên A, Vắng"
  | "Thành viên A, không Phân công"
  | "Tổ tư vấn A, không Phân công"
  | "Chủ tịch B"
  | "Thư ký B"
  | "Cán bộ Sở"
  | "Cán bộ xã"
  | "Chủ thể"
  | "Quản trị";
type State = "Thành viên xem xét" | "Sẵn sàng chốt" | "Đã chốt điểm";
type Action = "chốt" | "lập Phiên họp với hồ sơ" | "xem điểm";
type Outcome = "allowed" | "not_found" | "forbidden" | "invalid_state" | "not_ready_to_finalize" | "full" | "aggregate_only" | "none";

const ROWS: [Who, Action, State, Outcome][] = [
  // Chốt (stories 116, 117): the Chủ tịch and Thư ký of the Hội đồng, a hồ sơ Sẵn sàng chốt in a Phiên họp.
  ["Chủ tịch A", "chốt", "Sẵn sàng chốt", "allowed"],
  ["Thư ký A", "chốt", "Sẵn sàng chốt", "allowed"],
  ["Chủ tịch A", "chốt", "Thành viên xem xét", "invalid_state"],
  ["Thư ký A", "chốt", "Đã chốt điểm", "invalid_state"],
  ["Chủ tịch B", "chốt", "Sẵn sàng chốt", "not_found"],
  ["Thư ký B", "chốt", "Sẵn sàng chốt", "not_found"],
  // Story 64: the Tổ tư vấn never chốt; nor a thành viên, the Sở, the xã, the Chủ thể or Quản trị (story 132).
  ["Tổ tư vấn A, không Phân công", "chốt", "Sẵn sàng chốt", "forbidden"],
  ["Thành viên A, Vắng", "chốt", "Sẵn sàng chốt", "forbidden"],
  ["Cán bộ Sở", "chốt", "Sẵn sàng chốt", "forbidden"],
  ["Cán bộ xã", "chốt", "Sẵn sàng chốt", "forbidden"],
  ["Chủ thể", "chốt", "Sẵn sàng chốt", "forbidden"],
  ["Quản trị", "chốt", "Sẵn sàng chốt", "forbidden"],

  // Phiên họp (story 107): hồ sơ Sẵn sàng chốt only, by the Chủ tịch or Thư ký of the Hội đồng gán to the đợt.
  ["Chủ tịch A", "lập Phiên họp với hồ sơ", "Sẵn sàng chốt", "allowed"],
  ["Thư ký A", "lập Phiên họp với hồ sơ", "Sẵn sàng chốt", "allowed"],
  ["Thư ký A", "lập Phiên họp với hồ sơ", "Thành viên xem xét", "not_ready_to_finalize"],
  ["Thư ký A", "lập Phiên họp với hồ sơ", "Đã chốt điểm", "not_ready_to_finalize"],
  ["Thư ký B", "lập Phiên họp với hồ sơ", "Sẵn sàng chốt", "not_found"],
  ["Tổ tư vấn A, không Phân công", "lập Phiên họp với hồ sơ", "Sẵn sàng chốt", "forbidden"],
  ["Thành viên A, Vắng", "lập Phiên họp với hồ sơ", "Sẵn sàng chốt", "forbidden"],
  ["Cán bộ Sở", "lập Phiên họp với hồ sơ", "Sẵn sàng chốt", "forbidden"],
  ["Chủ thể", "lập Phiên họp với hồ sơ", "Sẵn sàng chốt", "forbidden"],
  ["Quản trị", "lập Phiên họp với hồ sơ", "Sẵn sàng chốt", "forbidden"],

  // After chốt (stories 122 to 125, 132): the Hội đồng and every thành viên chấm of the hồ sơ see it all, the Vắng too.
  ["Chủ tịch A", "xem điểm", "Đã chốt điểm", "full"],
  ["Thư ký A", "xem điểm", "Đã chốt điểm", "full"],
  ["Thành viên A, Vắng", "xem điểm", "Đã chốt điểm", "full"],
  ["Thành viên A, không Phân công", "xem điểm", "Đã chốt điểm", "not_found"],
  ["Tổ tư vấn A, không Phân công", "xem điểm", "Đã chốt điểm", "not_found"],
  ["Thư ký B", "xem điểm", "Đã chốt điểm", "not_found"],
  // L16 (#80, story 68): the Sở sees the kết quả chốt, never a phiếu.
  ["Cán bộ Sở", "xem điểm", "Đã chốt điểm", "aggregate_only"],
  ["Cán bộ xã", "xem điểm", "Đã chốt điểm", "none"],
  ["Chủ thể", "xem điểm", "Đã chốt điểm", "none"],
  ["Quản trị", "xem điểm", "Đã chốt điểm", "none"],
];

describe("Permission matrix: Phiên họp and chốt điểm (#60)", () => {
  const w = scoringWorld({ minGraders: 2 });
  const actors = {} as Record<Exclude<Who, "Chủ thể">, UserActor>;
  beforeAll(async () => {
    Object.assign(actors, {
      "Chủ tịch A": w.A.chair,
      "Thư ký A": w.A.secretary,
      "Thành viên A, Vắng": w.A.members[2]!,
      "Thành viên A, không Phân công": w.A.members[3]!,
      "Tổ tư vấn A, không Phân công": w.A.advisors[0]!,
      "Chủ tịch B": w.B.chair,
      "Thư ký B": w.B.secretary,
      "Cán bộ Sở": w.province,
      "Cán bộ xã": w.ward,
      "Quản trị": await w.f.admin(),
    });
  });

  const confirmAll = async (actor: UserActor, dossierId: string) => {
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "own_sheet") throw new Error(view.kind);
    const lines = ["1.1:40", "2.1:25", "3.1:35"].map((key) => ({
      criterionId: w.criterionId(key.split(":")[0]!),
      levelId: w.level(key),
      comment: "",
      evidenceFileIds: [],
    }));
    const { version } = await w.t.app.scoring.saveScoreSheet(actor, { dossierId, expectedVersion: view.sheet!.version, lines });
    await w.t.app.scoring.confirmScoreSheet(actor, { dossierId, expectedVersion: version });
  };
  const meeting = (actor: UserActor, dossierIds: string[]) =>
    w.t.app.scoring.createMeeting(actor, { roundId: w.roundId, title: "Phiên họp", heldOn: "2026-10-25", location: "Sở", dossierIds });
  const versionOf = async (dossierId: string) => (await w.t.app.dossiers.get(w.A.secretary, { dossierId })).version;

  async function dossierIn(state: State) {
    const d = await w.graded([w.A.members[0]!, w.A.members[1]!, w.A.members[2]!]);
    await confirmAll(w.A.members[0]!, d.dossierId);
    if (state !== "Thành viên xem xét") await confirmAll(w.A.members[1]!, d.dossierId);
    if (state === "Đã chốt điểm") {
      await meeting(w.A.secretary, [d.dossierId]);
      await w.t.app.scoring.finalize(w.A.secretary, { dossierId: d.dossierId, expectedVersion: await versionOf(d.dossierId) });
    }
    return d;
  }

  async function attempt(who: Who, action: Action, d: { a: UserActor; dossierId: string }): Promise<Outcome> {
    const actor = who === "Chủ thể" ? d.a : actors[who];
    const { dossierId } = d;
    switch (action) {
      case "xem điểm":
        return (await w.t.app.scoring.readDossierScores(actor, { dossierId })).kind as Outcome;
      case "lập Phiên họp với hồ sơ":
        await meeting(actor, [dossierId]);
        return "allowed";
      case "chốt": {
        // The Thư ký A has put a hồ sơ Sẵn sàng chốt on a Phiên họp's agenda first.
        const ready = (await w.t.app.dossiers.get(w.A.secretary, { dossierId })).state === "member_confirmed";
        if (ready) await meeting(w.A.secretary, [dossierId]);
        await w.t.app.scoring.finalize(actor, { dossierId, expectedVersion: await versionOf(dossierId) });
        return "allowed";
      }
    }
  }

  it.each(ROWS)("%s / %s / %s → %s", async (who, action, state, outcome) => {
    const d = await dossierIn(state);
    const run = attempt(who, action, d);
    if (outcome === "allowed" || outcome === "full" || outcome === "aggregate_only" || outcome === "none") await expect(run).resolves.toBe(outcome);
    else await expect(run).rejects.toMatchObject({ code: outcome });
  });
});
