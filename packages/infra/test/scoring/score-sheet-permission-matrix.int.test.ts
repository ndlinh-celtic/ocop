import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { scoringWorld, type ScoringWorld } from "./world";

/*
 * #14 permission matrix rows for the Phiếu chấm (#54, L14 TV-01, TV-05..07; spec #49 stories 64, 79, 81, 83, 89,
 * 92, 94, 95, 124, 132). Each hồ sơ is Giao chấm to thành viên chấm M0, M1, M3 of Hội đồng A and to the Thư ký A
 * (who also holds a Phân vai Thành viên hội đồng on A); M2 has no Phân công. The đợt needs 2 phiếu đã xác nhận:
 * "Sẵn sàng chốt" is M1 and M3 confirmed. Before each lưu or xác nhận row, the actor's phiếu (if any) is scored in full.
 */

type Who =
  | "Thành viên A, có Phân công"
  | "Thành viên A, không Phân công"
  | "Thành viên A, đã xác nhận"
  | "Thư ký A dùng vai Thành viên"
  | "Chủ tịch A"
  | "Thư ký A"
  | "Tổ tư vấn A, có Phân công"
  | "Thành viên B"
  | "Thư ký B"
  | "Cán bộ Sở"
  | "Cán bộ xã"
  | "Chủ thể"
  | "Quản trị";
type State = "Thành viên xem xét" | "Sẵn sàng chốt" | "Tổ tư vấn thẩm định";
type Action = "lưu phiếu" | "xác nhận phiếu" | "xem điểm";
type Outcome = "allowed" | "not_found" | "forbidden" | "invalid_state" | "progress_only" | "own_sheet" | "full" | "none";

function matrix(w: ScoringWorld, states: State[], rows: [Who, Action, State, Outcome][]) {
  const actors = {} as Record<Exclude<Who, "Chủ thể">, UserActor>;
  beforeAll(async () => {
    actors["Thành viên A, có Phân công"] = w.A.members[0]!;
    actors["Thành viên A, không Phân công"] = w.A.members[2]!;
    actors["Thành viên A, đã xác nhận"] = w.A.members[1]!;
    actors["Chủ tịch A"] = w.A.chair;
    actors["Thư ký A"] = w.A.secretary;
    actors["Tổ tư vấn A, có Phân công"] = w.A.advisors[0]!;
    actors["Thành viên B"] = w.B.members[0]!;
    actors["Thư ký B"] = w.B.secretary;
    actors["Cán bộ Sở"] = w.province;
    actors["Cán bộ xã"] = w.ward;
    actors["Quản trị"] = await w.f.admin();
    await w.f.grant(w.A.secretary, "council_member", w.A.councilId);
    actors["Thư ký A dùng vai Thành viên"] = await w.f.asRole(w.A.secretary, "council_member");
  });

  const FULL = ["1.1:40", "2.1:25", "3.1:35"];
  const scoreAll = async (actor: UserActor, dossierId: string) => {
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "own_sheet" || !view.sheet || view.sheet.state !== "draft") return null;
    return w.t.app.scoring.saveScoreSheet(actor, {
      dossierId,
      expectedVersion: view.sheet.version,
      lines: FULL.map((key) => ({ criterionId: w.criterionId(key.split(":")[0]!), levelId: w.level(key), comment: "", evidenceFileIds: [] })),
    });
  };

  async function dossierIn(state: State) {
    const people = [w.A.members[0]!, w.A.members[1]!, w.A.members[3]!, actors["Thư ký A dùng vai Thành viên"]];
    const d = await w.graded(people, state === "Tổ tư vấn thẩm định" ? [w.A.advisors[0]!] : []);
    if (state === "Sẵn sàng chốt") {
      for (const m of [w.A.members[1]!, w.A.members[3]!]) {
        const { version } = (await scoreAll(m, d.dossierId))!;
        await w.t.app.scoring.confirmScoreSheet(m, { dossierId: d.dossierId, expectedVersion: version });
      }
    }
    return d;
  }

  async function attempt(who: Who, action: Action, d: { a: UserActor; dossierId: string }): Promise<Outcome> {
    const actor = who === "Chủ thể" ? d.a : actors[who];
    const dossierId = d.dossierId;
    if (action === "xem điểm") return (await w.t.app.scoring.readDossierScores(actor, { dossierId })).kind;
    // The version the actor would have seen; 1 when they cannot see a phiếu (the call is refused before it matters).
    const prepared = action === "xác nhận phiếu" ? await scoreAll(actor, dossierId).catch(() => null) : null;
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId }).catch(() => null);
    const version = prepared?.version ?? (view?.kind === "own_sheet" ? (view.sheet?.version ?? 1) : 1);
    if (action === "lưu phiếu") {
      await w.t.app.scoring.saveScoreSheet(actor, {
        dossierId,
        expectedVersion: version,
        lines: [{ criterionId: w.criterionId("1.1"), levelId: w.level("1.1:20"), comment: "", evidenceFileIds: [] }],
      });
    } else {
      await w.t.app.scoring.confirmScoreSheet(actor, { dossierId, expectedVersion: version });
    }
    return "allowed";
  }

  it.each(rows.filter((r) => states.includes(r[2])))("%s / %s / %s → %s", async (who, action, state, outcome) => {
    const d = await dossierIn(state);
    const run = attempt(who, action, d);
    if (outcome === "allowed" || outcome === "progress_only" || outcome === "own_sheet" || outcome === "full" || outcome === "none") await expect(run).resolves.toBe(outcome);
    else await expect(run).rejects.toMatchObject({ code: outcome });
  });
}

const ROWS: [Who, Action, State, Outcome][] = [
  // Only a thành viên chấm writes, and only their own phiếu, in Thành viên xem xét and Sẵn sàng chốt (stories 83, 94).
  ["Thành viên A, có Phân công", "lưu phiếu", "Thành viên xem xét", "allowed"],
  ["Thành viên A, có Phân công", "lưu phiếu", "Sẵn sàng chốt", "allowed"],
  ["Thư ký A dùng vai Thành viên", "lưu phiếu", "Thành viên xem xét", "allowed"],
  ["Thành viên A, không Phân công", "lưu phiếu", "Thành viên xem xét", "not_found"],
  ["Thành viên B", "lưu phiếu", "Thành viên xem xét", "not_found"],
  ["Thư ký B", "lưu phiếu", "Thành viên xem xét", "forbidden"],
  ["Chủ tịch A", "lưu phiếu", "Thành viên xem xét", "forbidden"],
  ["Thư ký A", "lưu phiếu", "Thành viên xem xét", "forbidden"],
  ["Cán bộ Sở", "lưu phiếu", "Thành viên xem xét", "forbidden"],
  ["Cán bộ xã", "lưu phiếu", "Thành viên xem xét", "forbidden"],
  ["Chủ thể", "lưu phiếu", "Thành viên xem xét", "forbidden"],
  ["Quản trị", "lưu phiếu", "Thành viên xem xét", "forbidden"],
  // Story 81: dựa trên Tổ tư vấn, a thành viên sees the hồ sơ from Giao chấm but scores only after the first sao chép.
  ["Thành viên A, có Phân công", "lưu phiếu", "Tổ tư vấn thẩm định", "invalid_state"],
  // Story 64: the Tổ tư vấn never writes a thành viên's Phiếu chấm.
  ["Tổ tư vấn A, có Phân công", "lưu phiếu", "Tổ tư vấn thẩm định", "forbidden"],
  ["Tổ tư vấn A, có Phân công", "xác nhận phiếu", "Tổ tư vấn thẩm định", "forbidden"],

  // Xác nhận (stories 89, 94): the same people, until chốt.
  ["Thành viên A, có Phân công", "xác nhận phiếu", "Thành viên xem xét", "allowed"],
  ["Thành viên A, có Phân công", "xác nhận phiếu", "Sẵn sàng chốt", "allowed"],
  ["Thư ký A dùng vai Thành viên", "xác nhận phiếu", "Sẵn sàng chốt", "allowed"],
  ["Thành viên A, không Phân công", "xác nhận phiếu", "Thành viên xem xét", "not_found"],
  ["Thành viên B", "xác nhận phiếu", "Thành viên xem xét", "not_found"],
  ["Chủ tịch A", "xác nhận phiếu", "Sẵn sàng chốt", "forbidden"],
  ["Thư ký A", "xác nhận phiếu", "Sẵn sàng chốt", "forbidden"],
  ["Cán bộ Sở", "xác nhận phiếu", "Thành viên xem xét", "forbidden"],
  ["Chủ thể", "xác nhận phiếu", "Thành viên xem xét", "forbidden"],
  ["Quản trị", "xác nhận phiếu", "Thành viên xem xét", "forbidden"],
  ["Thành viên A, có Phân công", "xác nhận phiếu", "Tổ tư vấn thẩm định", "invalid_state"],

  // Who sees which points (stories 92, 93, 95, 124, 132): `full` from Sẵn sàng chốt, for a thành viên only once confirmed (#59).
  ["Thành viên A, có Phân công", "xem điểm", "Thành viên xem xét", "own_sheet"],
  ["Thành viên A, có Phân công", "xem điểm", "Sẵn sàng chốt", "own_sheet"],
  ["Thành viên A, có Phân công", "xem điểm", "Tổ tư vấn thẩm định", "own_sheet"],
  ["Thư ký A dùng vai Thành viên", "xem điểm", "Sẵn sàng chốt", "own_sheet"],
  ["Thành viên A, không Phân công", "xem điểm", "Thành viên xem xét", "not_found"],
  ["Chủ tịch A", "xem điểm", "Thành viên xem xét", "progress_only"],
  ["Chủ tịch A", "xem điểm", "Sẵn sàng chốt", "full"],
  ["Thư ký A", "xem điểm", "Sẵn sàng chốt", "full"],
  ["Thư ký A", "xem điểm", "Thành viên xem xét", "progress_only"],
  ["Thành viên A, đã xác nhận", "xem điểm", "Sẵn sàng chốt", "full"],
  ["Tổ tư vấn A, có Phân công", "xem điểm", "Tổ tư vấn thẩm định", "none"],
  ["Thành viên B", "xem điểm", "Thành viên xem xét", "not_found"],
  ["Thư ký B", "xem điểm", "Sẵn sàng chốt", "not_found"],
  ["Cán bộ Sở", "xem điểm", "Sẵn sàng chốt", "none"],
  ["Cán bộ xã", "xem điểm", "Sẵn sàng chốt", "none"],
  ["Chủ thể", "xem điểm", "Sẵn sàng chốt", "none"],
  ["Quản trị", "xem điểm", "Sẵn sàng chốt", "none"],
];

describe("Permission matrix: Phiếu chấm, chấm trực tiếp (#14, #54)", () => {
  const w = scoringWorld({ minGraders: 2 });
  matrix(w, ["Thành viên xem xét", "Sẵn sàng chốt"], ROWS);
});

describe("Permission matrix: Phiếu chấm, dựa trên Tổ tư vấn (#14, #54)", () => {
  const w = scoringWorld({ gradingMode: "advisory_based", minGraders: 2 });
  matrix(w, ["Tổ tư vấn thẩm định"], ROWS);
});
