import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "./fixtures";

/*
 * #14 permission matrix rows for the đề nghị trả về of the Tổ tư vấn and the Sở trả về from Tổ tư vấn thẩm
 * định (#57, L10 TM-03, spec #49 stories 51 to 55). The đợt is dựa trên Tổ tư vấn and gán to Hội đồng A. Every
 * hồ sơ is Phân công to Thành viên A as thành viên chấm and to Tổ trưởng A and Tổ tư vấn A as Thành viên Tổ tư
 * vấn, then Giao chấm; one đề nghị is sent before each row. Hội đồng B is on no đợt.
 */

type Who =
  | "Tổ trưởng A, có Phân công"
  | "Tổ tư vấn A, có Phân công"
  | "Tổ tư vấn A, không Phân công"
  | "Tổ tư vấn B"
  | "Thành viên A, có Phân công"
  | "Chủ tịch A"
  | "Thư ký A"
  | "Cán bộ Sở"
  | "Cán bộ xã"
  | "Quản trị"
  | "Chủ thể";
type Action = "đề nghị trả về" | "xem đề nghị trả về" | "trả về xã";
type State = "Tổ tư vấn thẩm định" | "Đã có báo cáo Tổ tư vấn" | "Thành viên xem xét" | "Sẵn sàng chốt" | "Đã chốt điểm";
type Outcome = "allowed" | "not_found" | "forbidden" | "invalid_state";

const STATES: State[] = ["Tổ tư vấn thẩm định", "Đã có báo cáo Tổ tư vấn", "Thành viên xem xét", "Sẵn sàng chốt", "Đã chốt điểm"];
const STATE_CODE: Record<Exclude<State, "Tổ tư vấn thẩm định" | "Đã có báo cáo Tổ tư vấn">, string> = {
  "Thành viên xem xét": "member_review",
  "Sẵn sàng chốt": "member_confirmed",
  "Đã chốt điểm": "score_finalized",
};
const A_ = "allowed";
const NF = "not_found";
const FB = "forbidden";
const IS = "invalid_state";

/**
 * Outcomes in the order of STATES. Only a Thành viên Tổ tư vấn Phân công asks, and only in Tổ tư vấn thẩm định
 * (story 51); the Sở and that Tổ tư vấn read the đề nghị, nobody else (stories 52, 53); the Sở trả về only from
 * Tổ tư vấn thẩm định, never once Phiếu chấm are being written (story 55).
 */
const TABLE: Record<Who, Record<Action, Outcome[]>> = {
  "Tổ trưởng A, có Phân công": { "đề nghị trả về": [A_, IS, IS, IS, IS], "xem đề nghị trả về": [A_, A_, A_, A_, A_], "trả về xã": [FB, FB, FB, FB, FB] },
  "Tổ tư vấn A, có Phân công": { "đề nghị trả về": [A_, IS, IS, IS, IS], "xem đề nghị trả về": [A_, A_, A_, A_, A_], "trả về xã": [FB, FB, FB, FB, FB] },
  "Tổ tư vấn A, không Phân công": { "đề nghị trả về": [NF, NF, NF, NF, NF], "xem đề nghị trả về": [NF, NF, NF, NF, NF], "trả về xã": [FB, FB, FB, FB, FB] },
  "Tổ tư vấn B": { "đề nghị trả về": [NF, NF, NF, NF, NF], "xem đề nghị trả về": [NF, NF, NF, NF, NF], "trả về xã": [FB, FB, FB, FB, FB] },
  "Thành viên A, có Phân công": { "đề nghị trả về": [FB, FB, FB, FB, FB], "xem đề nghị trả về": [FB, FB, FB, FB, FB], "trả về xã": [FB, FB, FB, FB, FB] },
  "Chủ tịch A": { "đề nghị trả về": [FB, FB, FB, FB, FB], "xem đề nghị trả về": [FB, FB, FB, FB, FB], "trả về xã": [FB, FB, FB, FB, FB] },
  "Thư ký A": { "đề nghị trả về": [FB, FB, FB, FB, FB], "xem đề nghị trả về": [FB, FB, FB, FB, FB], "trả về xã": [FB, FB, FB, FB, FB] },
  "Cán bộ Sở": { "đề nghị trả về": [FB, FB, FB, FB, FB], "xem đề nghị trả về": [A_, A_, A_, A_, A_], "trả về xã": [A_, IS, IS, IS, IS] },
  "Cán bộ xã": { "đề nghị trả về": [FB, FB, FB, FB, FB], "xem đề nghị trả về": [FB, FB, FB, FB, FB], "trả về xã": [FB, FB, FB, FB, FB] },
  "Quản trị": { "đề nghị trả về": [FB, FB, FB, FB, FB], "xem đề nghị trả về": [FB, FB, FB, FB, FB], "trả về xã": [FB, FB, FB, FB, FB] },
  "Chủ thể": { "đề nghị trả về": [FB, FB, FB, FB, FB], "xem đề nghị trả về": [FB, FB, FB, FB, FB], "trả về xã": [FB, FB, FB, FB, FB] },
};

const MATRIX: [Who, Action, State, Outcome][] = (Object.entries(TABLE) as [Who, Record<Action, Outcome[]>][]).flatMap(([who, byAction]) =>
  (Object.entries(byAction) as [Action, Outcome[]][]).flatMap(([action, outcomes]) => STATES.map((state, i): [Who, Action, State, Outcome] => [who, action, state, outcomes[i]!])),
);

let db: TestDatabase;
let t: TestApp;
let f: ReturnType<typeof fixtures>;
let setId: string;
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
  actors["Cán bộ xã"] = await f.staff("ward_officer", wardId);
  const province = (actors["Cán bộ Sở"] = await f.staff("province_officer"));
  A = await f.staffedCouncil(province, { members: 1, advisors: 3 });
  const B = await f.staffedCouncil(province, { members: 1, advisors: 1 });
  await t.app.councils.setLeader(province, { councilId: A.councilId, userId: A.advisors[0]!.userId });
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

/**
 * A hồ sơ in `state` with one đề nghị trả về. Tổ tư vấn thẩm định and Đã có báo cáo Tổ tư vấn are reached by use
 * cases; the later states only by the sao chép and chốt of later tickets, so they are set by the DB owner.
 */
async function dossierIn(state: State): Promise<Subject> {
  const leader = actors["Tổ trưởng A, có Phân công"];
  const d = await f.gradingStarted(actors["Cán bộ xã"], actors["Cán bộ Sở"], setId, A.secretary, { members: A.members, advisors: [leader, actors["Tổ tư vấn A, có Phân công"]] });
  let { version } = await t.app.dossiers.requestAdvisoryReturn(leader, { dossierId: d.dossierId, expectedVersion: d.version, reason: "Thiếu hồ sơ" });
  if (state === "Tổ tư vấn thẩm định") return { a: d.a, dossierId: d.dossierId, version };
  const ws = await t.app.scoring.advisoryReport(leader, { dossierId: d.dossierId });
  await t.app.scoring.saveAdvisoryDraft(leader, {
    dossierId: d.dossierId,
    draftVersion: 0,
    lines: ws.criteria.map((c) => ({ criterionId: c.criterionId, levelId: c.levels[0]!.id, basis: "Căn cứ", evidenceFileIds: [], evidenceAssessment: null })),
    summary: "",
    notes: "",
    attachmentFileIds: [],
  });
  ({ version } = await t.app.scoring.issueAdvisoryReport(leader, { dossierId: d.dossierId, expectedVersion: version + 1 }));
  if (state === "Đã có báo cáo Tổ tư vấn") return { a: d.a, dossierId: d.dossierId, version };
  await db.admin.query("UPDATE dossier.dossier SET state = $2, version = version + 1 WHERE id = $1", [d.dossierId, STATE_CODE[state]]);
  return { a: d.a, dossierId: d.dossierId, version: version + 1 };
}

async function attempt(who: Who, action: Action, d: Subject): Promise<void> {
  const actor = who === "Chủ thể" ? d.a : actors[who];
  const { dossierId } = d;
  switch (action) {
    case "đề nghị trả về":
      await t.app.dossiers.requestAdvisoryReturn(actor, { dossierId, expectedVersion: d.version, reason: "Thiếu hồ sơ" });
      return;
    case "xem đề nghị trả về":
      await t.app.dossiers.advisoryReturnRequests(actor, { dossierId });
      return;
    case "trả về xã":
      await t.app.dossiers.returnFromProvince(actor, { dossierId, expectedVersion: d.version, deadline: "2026-11-10", items: [{ content: "Bổ sung" }] });
      return;
  }
}

describe("Permission matrix: đề nghị trả về of the Tổ tư vấn and trả về from Tổ tư vấn thẩm định (#14, #57, L10 TM-03, stories 51 to 55)", () => {
  // Reads and refusals share one hồ sơ per state; a write that goes through gets a fresh one.
  const shared = new Map<State, Promise<Subject>>();
  const subject = (state: State, fresh: boolean) => {
    if (fresh) return dossierIn(state);
    if (!shared.has(state)) shared.set(state, dossierIn(state));
    return shared.get(state)!;
  };

  it.each(MATRIX)("%s / %s / %s → %s", async (who, action, state, outcome) => {
    const d = await subject(state, outcome === "allowed" && action !== "xem đề nghị trả về");
    const run = attempt(who, action, d);
    if (outcome === "allowed") await expect(run).resolves.toBeUndefined();
    else await expect(run).rejects.toMatchObject({ code: outcome });
  });
});
