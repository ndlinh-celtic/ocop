import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { scoringWorld, type ScoringWorld } from "./world";

/*
 * #14 permission matrix rows for Trả phiếu (#61, L15 HD-05; spec #49 stories 64, 102 to 106, 132). Each hồ sơ is
 * Giao chấm to M0, M1 and M3 of Hội đồng A; M1 has confirmed, and for "Sẵn sàng chốt" M3 too (the đợt needs 2).
 * The phiếu returned is M1's. Only the Chủ tịch and Thư ký of the hồ sơ's Hội đồng return a phiếu or read the
 * phiếu bị thay thế; the Tổ tư vấn never does (story 64), nor Quản trị (story 132).
 */

type Who = "Chủ tịch A" | "Thư ký A" | "Thư ký A dùng vai Thành viên" | "Thành viên A, có Phân công" | "Tổ tư vấn A" | "Chủ tịch B" | "Thư ký B" | "Cán bộ Sở" | "Chủ thể" | "Quản trị";
type State = "Thành viên xem xét" | "Sẵn sàng chốt" | "Tổ tư vấn thẩm định";
type Action = "Trả phiếu" | "xem phiếu bị thay thế";
type Outcome = "allowed" | "not_found" | "forbidden" | "invalid_state";

function matrix(w: ScoringWorld, states: State[], rows: [Who, Action, State, Outcome][]) {
  const actors = {} as Record<Exclude<Who, "Chủ thể">, UserActor>;
  beforeAll(async () => {
    actors["Chủ tịch A"] = w.A.chair;
    actors["Thư ký A"] = w.A.secretary;
    actors["Thành viên A, có Phân công"] = w.A.members[0]!;
    actors["Tổ tư vấn A"] = w.A.advisors[0]!;
    actors["Chủ tịch B"] = w.B.chair;
    actors["Thư ký B"] = w.B.secretary;
    actors["Cán bộ Sở"] = w.province;
    actors["Quản trị"] = await w.f.admin();
    await w.f.grant(w.A.secretary, "council_member", w.A.councilId);
    actors["Thư ký A dùng vai Thành viên"] = await w.f.asRole(w.A.secretary, "council_member");
  });

  const FULL = ["1.1:40", "2.1:25", "3.1:35"];
  async function confirm(actor: UserActor, dossierId: string) {
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId, ownSheet: true });
    if (view.kind !== "own_sheet") throw new Error(view.kind);
    const lines = FULL.map((key) => ({ criterionId: w.criterionId(key.split(":")[0]!), levelId: w.level(key), comment: "", evidenceFileIds: [] }));
    const { version } = await w.t.app.scoring.saveScoreSheet(actor, { dossierId, expectedVersion: view.sheet!.version, lines });
    await w.t.app.scoring.confirmScoreSheet(actor, { dossierId, expectedVersion: version });
    return view.sheet!.id;
  }

  /** The hồ sơ and the id of M1's phiếu (whatever its state). */
  async function dossierIn(state: State) {
    const [m0, m1, , m3] = w.A.members;
    const d = await w.graded([m0!, m1!, m3!], state === "Tổ tư vấn thẩm định" ? [w.A.advisors[0]!] : []);
    if (state === "Tổ tư vấn thẩm định") {
      const { rows } = await w.db.admin.query(
        "SELECT s.id FROM scoring.score_sheet s JOIN council.assignment a ON a.id = s.assignment_id WHERE s.dossier_id = $1 AND a.user_id = $2",
        [d.dossierId, m1!.userId],
      );
      return { d, sheetId: rows[0]!.id as string };
    }
    const sheetId = await confirm(m1!, d.dossierId);
    if (state === "Sẵn sàng chốt") await confirm(m3!, d.dossierId);
    return { d, sheetId };
  }

  async function attempt(who: Who, action: Action, { d, sheetId }: Awaited<ReturnType<typeof dossierIn>>): Promise<Outcome> {
    const actor = who === "Chủ thể" ? d.a : actors[who];
    if (action === "Trả phiếu") await w.t.app.scoring.returnScoreSheet(actor, { dossierId: d.dossierId, sheetId, reason: "Chấm lại" });
    else await w.t.app.scoring.scoreSheetHistory(actor, { dossierId: d.dossierId });
    return "allowed";
  }

  it.each(rows.filter((r) => states.includes(r[2])))("%s / %s / %s → %s", async (who, action, state, outcome) => {
    const run = attempt(who, action, await dossierIn(state));
    if (outcome === "allowed") await expect(run).resolves.toBe(outcome);
    else await expect(run).rejects.toMatchObject({ code: outcome });
  });
}

const ROWS: [Who, Action, State, Outcome][] = [
  // Stories 102, 105: the Chủ tịch or Thư ký of the Hội đồng, before chốt.
  ["Chủ tịch A", "Trả phiếu", "Sẵn sàng chốt", "allowed"],
  ["Thư ký A", "Trả phiếu", "Sẵn sàng chốt", "allowed"],
  ["Chủ tịch A", "Trả phiếu", "Thành viên xem xét", "allowed"],
  ["Thư ký A", "Trả phiếu", "Thành viên xem xét", "allowed"],
  ["Thư ký A dùng vai Thành viên", "Trả phiếu", "Sẵn sàng chốt", "forbidden"],
  ["Thành viên A, có Phân công", "Trả phiếu", "Sẵn sàng chốt", "forbidden"],
  ["Chủ tịch B", "Trả phiếu", "Sẵn sàng chốt", "not_found"],
  ["Thư ký B", "Trả phiếu", "Sẵn sàng chốt", "not_found"],
  ["Cán bộ Sở", "Trả phiếu", "Sẵn sàng chốt", "forbidden"],
  ["Chủ thể", "Trả phiếu", "Sẵn sàng chốt", "forbidden"],
  ["Quản trị", "Trả phiếu", "Sẵn sàng chốt", "forbidden"],
  // Story 64: the Tổ tư vấn never returns a phiếu; and there is none to return while it thẩm định.
  ["Tổ tư vấn A", "Trả phiếu", "Sẵn sàng chốt", "forbidden"],
  ["Tổ tư vấn A", "Trả phiếu", "Tổ tư vấn thẩm định", "forbidden"],
  ["Chủ tịch A", "Trả phiếu", "Tổ tư vấn thẩm định", "invalid_state"],
  ["Thư ký A", "Trả phiếu", "Tổ tư vấn thẩm định", "invalid_state"],

  // Story 104: the phiếu bị thay thế, for the Chủ tịch and Thư ký alone.
  ["Chủ tịch A", "xem phiếu bị thay thế", "Sẵn sàng chốt", "allowed"],
  ["Thư ký A", "xem phiếu bị thay thế", "Thành viên xem xét", "allowed"],
  ["Thư ký A dùng vai Thành viên", "xem phiếu bị thay thế", "Sẵn sàng chốt", "forbidden"],
  ["Thành viên A, có Phân công", "xem phiếu bị thay thế", "Sẵn sàng chốt", "forbidden"],
  ["Tổ tư vấn A", "xem phiếu bị thay thế", "Sẵn sàng chốt", "forbidden"],
  ["Thư ký B", "xem phiếu bị thay thế", "Sẵn sàng chốt", "not_found"],
  ["Cán bộ Sở", "xem phiếu bị thay thế", "Sẵn sàng chốt", "forbidden"],
  ["Chủ thể", "xem phiếu bị thay thế", "Sẵn sàng chốt", "forbidden"],
  ["Quản trị", "xem phiếu bị thay thế", "Sẵn sàng chốt", "forbidden"],
];

describe("Permission matrix: Trả phiếu, chấm trực tiếp (#14, #61)", () => {
  const w = scoringWorld({ minGraders: 2 });
  matrix(w, ["Thành viên xem xét", "Sẵn sàng chốt"], ROWS);
});

describe("Permission matrix: Trả phiếu, dựa trên Tổ tư vấn (#14, #61)", () => {
  const w = scoringWorld({ gradingMode: "advisory_based", minGraders: 2 });
  matrix(w, ["Tổ tư vấn thẩm định"], ROWS);
});
