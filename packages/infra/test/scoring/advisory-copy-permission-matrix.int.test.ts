import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "../dossiers/fixtures";

/*
 * #14 permission matrix rows for the sao chép sang Phiếu chấm (#58, L12 TM-08, TM-09, TM-12; spec #49 stories 64,
 * 65, 74, 81). The đợt is dựa trên Tổ tư vấn, minGraders 1, gán to Hội đồng A. Every hồ sơ is Phân công to Thành
 * viên A and a second thành viên chấm, and to Tổ trưởng A and Tổ tư vấn A as Thành viên Tổ tư vấn, then Giao chấm.
 * In Sẵn sàng chốt the second thành viên has xác nhận; Thành viên A's phiếu is still a nháp.
 */

type Who =
  | "Tổ trưởng A, có Phân công"
  | "Tổ tư vấn A, có Phân công"
  | "Tổ tư vấn A, không Phân công"
  | "Tổ tư vấn B"
  | "Thành viên A, có Phân công"
  | "Chủ tịch A"
  | "Thư ký A"
  | "Quản trị"
  | "Cán bộ Sở"
  | "Chủ thể";
type Action = "sao chép" | "xem trước" | "lưu Phiếu chấm";
type State = "Tổ tư vấn thẩm định" | "Đã có báo cáo Tổ tư vấn" | "Thành viên xem xét" | "Sẵn sàng chốt";
type Outcome = "allowed" | "not_found" | "forbidden" | "invalid_state";

const ACTIONS: Action[] = ["sao chép", "xem trước", "lưu Phiếu chấm"];
const STATES: State[] = ["Tổ tư vấn thẩm định", "Đã có báo cáo Tổ tư vấn", "Thành viên xem xét", "Sẵn sàng chốt"];
const A_ = "allowed";
const NF = "not_found";
const FB = "forbidden";
const IS = "invalid_state";

/**
 * Outcomes in the order of ACTIONS, per state in the order of STATES. Any Thành viên Tổ tư vấn Phân công copies
 * once a phiên bản is issued (story 65); only the thành viên chấm writes a Phiếu chấm, and only after the first
 * sao chép (stories 64, 81).
 */
const TABLE: Record<Who, Outcome[][]> = {
  "Tổ trưởng A, có Phân công": [[IS, IS, FB], [A_, A_, FB], [A_, A_, FB], [A_, A_, FB]],
  "Tổ tư vấn A, có Phân công": [[IS, IS, FB], [A_, A_, FB], [A_, A_, FB], [A_, A_, FB]],
  "Tổ tư vấn A, không Phân công": [[NF, NF, FB], [NF, NF, FB], [NF, NF, FB], [NF, NF, FB]],
  "Tổ tư vấn B": [[NF, NF, FB], [NF, NF, FB], [NF, NF, FB], [NF, NF, FB]],
  "Thành viên A, có Phân công": [[FB, FB, IS], [FB, FB, IS], [FB, FB, A_], [FB, FB, A_]],
  "Chủ tịch A": [[FB, FB, FB], [FB, FB, FB], [FB, FB, FB], [FB, FB, FB]],
  "Thư ký A": [[FB, FB, FB], [FB, FB, FB], [FB, FB, FB], [FB, FB, FB]],
  "Quản trị": [[FB, FB, FB], [FB, FB, FB], [FB, FB, FB], [FB, FB, FB]],
  "Cán bộ Sở": [[FB, FB, FB], [FB, FB, FB], [FB, FB, FB], [FB, FB, FB]],
  "Chủ thể": [[FB, FB, FB], [FB, FB, FB], [FB, FB, FB], [FB, FB, FB]],
};

const MATRIX: [Who, Action, State, Outcome][] = (Object.entries(TABLE) as [Who, Outcome[][]][]).flatMap(([who, byState]) =>
  STATES.flatMap((state, s) => ACTIONS.map((action, i): [Who, Action, State, Outcome] => [who, action, state, byState[s]![i]!])),
);

let db: TestDatabase;
let t: TestApp;
let f: ReturnType<typeof fixtures>;
let setId: string;
let ward: UserActor;
const actors = {} as Record<Exclude<Who, "Chủ thể">, UserActor>;
let A: Awaited<ReturnType<ReturnType<typeof fixtures>["staffedCouncil"]>>;

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n");
  const wardId = (await t.app.org.listWards())[0]!.id;
  f = fixtures(t, () => wardId);
  t.clock.set(new Date("2026-10-19T02:00:00Z"));
  const version = await f.publishedVersion("26/2026/QĐ-TTg");
  setId = version.sets["Rau củ quả"];
  ward = await f.staff("ward_officer", wardId);
  const province = (actors["Cán bộ Sở"] = await f.staff("province_officer"));
  A = await f.staffedCouncil(province, { members: 2, advisors: 3 });
  const B = await f.staffedCouncil(province, { members: 1, advisors: 1 });
  const roundId = await f.openRound(version.versionId, { gradingMode: "advisory_based", minGraders: 1 });
  await t.app.rounds.assignCouncil(province, { roundId, councilId: A.councilId });
  actors["Tổ trưởng A, có Phân công"] = A.advisors[0]!;
  actors["Tổ tư vấn A, có Phân công"] = A.advisors[1]!;
  actors["Tổ tư vấn A, không Phân công"] = A.advisors[2]!;
  actors["Tổ tư vấn B"] = B.advisors[0]!;
  actors["Thành viên A, có Phân công"] = A.members[0]!;
  actors["Chủ tịch A"] = A.chair;
  actors["Thư ký A"] = A.secretary;
  actors["Quản trị"] = await f.admin();
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

interface Subject {
  a: UserActor;
  dossierId: string;
  version: number;
}

async function dossierIn(state: State): Promise<Subject> {
  const people = { members: A.members, advisors: [actors["Tổ trưởng A, có Phân công"], actors["Tổ tư vấn A, có Phân công"]] };
  const args = [ward, actors["Cán bộ Sở"], setId, A.secretary, people] as const;
  if (state === "Tổ tư vấn thẩm định") return f.gradingStarted(...args);
  if (state === "Đã có báo cáo Tổ tư vấn") return f.advisoryIssued(...args);
  const d = await f.advisoryCopied(...args);
  if (state === "Thành viên xem xét") return d;
  const other = A.members[1]!;
  const sheet = await t.app.scoring.readDossierScores(other, { dossierId: d.dossierId, ownSheet: true });
  await t.app.scoring.confirmScoreSheet(other, { dossierId: d.dossierId, expectedVersion: sheet.kind === "own_sheet" ? sheet.sheet!.version : 0 });
  return { ...d, version: (await t.app.dossiers.get(A.secretary, { dossierId: d.dossierId })).version };
}

async function attempt(who: Who, action: Action, d: Subject): Promise<void> {
  const actor = who === "Chủ thể" ? d.a : actors[who];
  const scope = { criteria: "all" as const, recipients: "all" as const };
  switch (action) {
    case "sao chép":
      await t.app.scoring.copyAdvisory(actor, { dossiers: [{ dossierId: d.dossierId, expectedVersion: d.version }], ...scope });
      return;
    case "xem trước":
      await t.app.scoring.previewAdvisoryCopy(actor, { dossiers: [{ dossierId: d.dossierId }], ...scope });
      return;
    case "lưu Phiếu chấm": {
      // The Mức điểm the dòng already holds (the copied one once copied), so no lý do điều chỉnh is needed.
      const own = actor === actors["Thành viên A, có Phân công"] ? await t.app.scoring.readDossierScores(actor, { dossierId: d.dossierId, ownSheet: true }) : null;
      const c = own?.kind === "own_sheet" ? own.criteria[0]! : null;
      await t.app.scoring.saveScoreSheet(actor, {
        dossierId: d.dossierId,
        expectedVersion: own?.kind === "own_sheet" ? own.sheet!.version : 1,
        lines: [{ criterionId: c?.criterionId ?? d.dossierId, levelId: c?.levelId ?? null, comment: "", evidenceFileIds: [] }],
      });
      return;
    }
  }
}

describe("Permission matrix: sao chép sang Phiếu chấm (#14, #58, L12 TM-08, TM-09, TM-12, stories 64, 65, 74, 81)", () => {
  // Refusals share one hồ sơ per state; a write that goes through gets a fresh one.
  const shared = new Map<State, Promise<Subject>>();
  const subject = (state: State, fresh: boolean) => {
    if (fresh) return dossierIn(state);
    if (!shared.has(state)) shared.set(state, dossierIn(state));
    return shared.get(state)!;
  };

  it.each(MATRIX)("%s / %s / %s → %s", async (who, action, state, outcome) => {
    const d = await subject(state, outcome === "allowed" && action !== "xem trước");
    const run = attempt(who, action, d);
    if (outcome === "allowed") await expect(run).resolves.toBeUndefined();
    else await expect(run).rejects.toMatchObject({ code: outcome });
  });
});
