import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "../dossiers/fixtures";

/*
 * #14 permission matrix rows for the Báo cáo Tổ tư vấn (#56, L10, L11 TM-07, TM-12; spec #49 stories 49, 58, 61,
 * 63, 64). The đợt is dựa trên Tổ tư vấn and gán to Hội đồng A. Every hồ sơ is Phân công to Thành viên A as
 * thành viên chấm and to Tổ trưởng A and Tổ tư vấn A as Thành viên Tổ tư vấn, then Giao chấm. Hội đồng B has
 * its own Tổ trưởng, on no đợt. A nháp complete on every Tiêu chí is saved before each row.
 */

type Who =
  | "Tổ trưởng A, có Phân công"
  | "Tổ tư vấn A, có Phân công"
  | "Tổ tư vấn A, không Phân công"
  | "Tổ trưởng B"
  | "Thành viên A, có Phân công"
  | "Chủ tịch A"
  | "Thư ký A"
  | "Quản trị"
  | "Cán bộ Sở"
  | "Chủ thể";
type Action = "lưu nháp" | "phát hành" | "phát hành lại" | "đọc nháp" | "đọc phiên bản" | "Giao chấm" | "Phân công";
type State = "Tổ tư vấn thẩm định" | "Đã có báo cáo Tổ tư vấn";
type Outcome = "allowed" | "not_found" | "forbidden" | "invalid_state";

const ACTIONS: Action[] = ["lưu nháp", "phát hành", "phát hành lại", "đọc nháp", "đọc phiên bản", "Giao chấm", "Phân công"];
const A_ = "allowed";
const NF = "not_found";
const FB = "forbidden";
const IS = "invalid_state";

/**
 * Outcomes in the order of ACTIONS. The Tổ tư vấn writes the nháp and only the Tổ trưởng issues it (stories 49, 58);
 * the Vai trò hội đồng read only the phiên bản (story 63); the Tổ tư vấn never Giao chấm nor Phân công (story 64).
 */
const TABLE: Record<Who, Record<State, Outcome[]>> = {
  "Tổ trưởng A, có Phân công": { "Tổ tư vấn thẩm định": [A_, A_, IS, A_, A_, FB, FB], "Đã có báo cáo Tổ tư vấn": [IS, IS, A_, A_, A_, FB, FB] },
  "Tổ tư vấn A, có Phân công": { "Tổ tư vấn thẩm định": [A_, FB, IS, A_, A_, FB, FB], "Đã có báo cáo Tổ tư vấn": [IS, IS, FB, A_, A_, FB, FB] },
  "Tổ tư vấn A, không Phân công": { "Tổ tư vấn thẩm định": [NF, NF, NF, NF, NF, FB, FB], "Đã có báo cáo Tổ tư vấn": [NF, NF, NF, NF, NF, FB, FB] },
  "Tổ trưởng B": { "Tổ tư vấn thẩm định": [NF, NF, NF, NF, NF, FB, FB], "Đã có báo cáo Tổ tư vấn": [NF, NF, NF, NF, NF, FB, FB] },
  "Thành viên A, có Phân công": { "Tổ tư vấn thẩm định": [FB, FB, FB, FB, A_, FB, FB], "Đã có báo cáo Tổ tư vấn": [FB, FB, FB, FB, A_, FB, FB] },
  "Chủ tịch A": { "Tổ tư vấn thẩm định": [FB, FB, FB, FB, A_, FB, FB], "Đã có báo cáo Tổ tư vấn": [FB, FB, FB, FB, A_, FB, FB] },
  "Thư ký A": { "Tổ tư vấn thẩm định": [FB, FB, FB, FB, A_, IS, IS], "Đã có báo cáo Tổ tư vấn": [FB, FB, FB, FB, A_, IS, IS] },
  "Quản trị": { "Tổ tư vấn thẩm định": [FB, FB, FB, FB, FB, FB, FB], "Đã có báo cáo Tổ tư vấn": [FB, FB, FB, FB, FB, FB, FB] },
  "Cán bộ Sở": { "Tổ tư vấn thẩm định": [FB, FB, FB, FB, FB, FB, FB], "Đã có báo cáo Tổ tư vấn": [FB, FB, FB, FB, FB, FB, FB] },
  "Chủ thể": { "Tổ tư vấn thẩm định": [FB, FB, FB, FB, FB, FB, FB], "Đã có báo cáo Tổ tư vấn": [FB, FB, FB, FB, FB, FB, FB] },
};

const MATRIX: [Who, Action, State, Outcome][] = (Object.entries(TABLE) as [Who, Record<State, Outcome[]>][]).flatMap(([who, byState]) =>
  (Object.entries(byState) as [State, Outcome[]][]).flatMap(([state, outcomes]) => ACTIONS.map((action, i): [Who, Action, State, Outcome] => [who, action, state, outcomes[i]!])),
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
  A = await f.staffedCouncil(province, { members: 1, advisors: 3 });
  const B = await f.staffedCouncil(province, { members: 1, advisors: 1 });
  await t.app.councils.setLeader(province, { councilId: A.councilId, userId: A.advisors[0]!.userId });
  await t.app.councils.setLeader(province, { councilId: B.councilId, userId: B.advisors[0]!.userId });
  const roundId = await f.openRound(version.versionId, { gradingMode: "advisory_based", minGraders: 1 });
  await t.app.rounds.assignCouncil(province, { roundId, councilId: A.councilId });
  actors["Tổ trưởng A, có Phân công"] = A.advisors[0]!;
  actors["Tổ tư vấn A, có Phân công"] = A.advisors[1]!;
  actors["Tổ tư vấn A, không Phân công"] = A.advisors[2]!;
  actors["Tổ trưởng B"] = B.advisors[0]!;
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
  const leader = actors["Tổ trưởng A, có Phân công"];
  const d = await f.gradingStarted(ward, actors["Cán bộ Sở"], setId, A.secretary, { members: A.members, advisors: [leader, actors["Tổ tư vấn A, có Phân công"]] });
  const ws = await t.app.scoring.advisoryReport(leader, { dossierId: d.dossierId });
  await t.app.scoring.saveAdvisoryDraft(leader, {
    dossierId: d.dossierId,
    draftVersion: 0,
    lines: ws.criteria.map((c) => ({ criterionId: c.criterionId, levelId: c.levels[0]!.id, basis: "Căn cứ", evidenceFileIds: [], evidenceAssessment: null })),
    summary: "",
    notes: "",
    attachmentFileIds: [],
  });
  let version = ws.dossierVersion;
  if (state === "Đã có báo cáo Tổ tư vấn") ({ version } = await t.app.scoring.issueAdvisoryReport(leader, { dossierId: d.dossierId, expectedVersion: version }));
  return { a: d.a, dossierId: d.dossierId, version };
}

async function attempt(who: Who, action: Action, d: Subject): Promise<void> {
  const actor = who === "Chủ thể" ? d.a : actors[who];
  const { dossierId } = d;
  const content = { lines: [], summary: "Sửa", notes: "", attachmentFileIds: [] };
  switch (action) {
    case "lưu nháp":
      await t.app.scoring.saveAdvisoryDraft(actor, { dossierId, draftVersion: 1, ...content });
      return;
    case "phát hành":
      await t.app.scoring.issueAdvisoryReport(actor, { dossierId, expectedVersion: d.version });
      return;
    case "phát hành lại": {
      // The content of phiên bản 1 as it was, so that only who and when decide.
      const ws = await t.app.scoring.advisoryReport(actors["Tổ trưởng A, có Phân công"], { dossierId });
      const lines = ws.criteria.map((c) => ({ ...c.line }));
      await t.app.scoring.reissueAdvisoryReport(actor, { dossierId, expectedVersion: d.version, reason: "Sửa", ...content, lines });
      return;
    }
    case "đọc nháp":
      await t.app.scoring.advisoryReport(actor, { dossierId });
      return;
    case "đọc phiên bản":
      await t.app.scoring.advisoryReportVersions(actor, { dossierId });
      return;
    case "Giao chấm":
      await t.app.councils.startGrading(actor, { dossiers: [{ dossierId, expectedVersion: d.version }] });
      return;
    case "Phân công":
      await t.app.councils.editAssignments(actor, { dossiers: [{ dossierId, expectedVersion: d.version }], members: [], advisors: [] });
      return;
  }
}

describe("Permission matrix: Báo cáo Tổ tư vấn (#14, #56, L10, L11 TM-07, TM-12, stories 49, 58, 61, 63, 64)", () => {
  // Reads and refusals share one hồ sơ per state; a write that goes through gets a fresh one.
  const shared = new Map<State, Promise<Subject>>();
  const subject = (state: State, fresh: boolean) => {
    if (fresh) return dossierIn(state);
    if (!shared.has(state)) shared.set(state, dossierIn(state));
    return shared.get(state)!;
  };
  const WRITES: Action[] = ["lưu nháp", "phát hành", "phát hành lại"];

  it.each(MATRIX)("%s / %s / %s → %s", async (who, action, state, outcome) => {
    const d = await subject(state, outcome === "allowed" && WRITES.includes(action));
    const run = attempt(who, action, d);
    if (outcome === "allowed") await expect(run).resolves.toBeUndefined();
    else await expect(run).rejects.toMatchObject({ code: outcome });
  });
});
