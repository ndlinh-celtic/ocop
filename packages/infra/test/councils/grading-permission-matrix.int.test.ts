import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "../dossiers/fixtures";

/*
 * #14 permission matrix rows for Giao chấm and Chế độ chấm (#53, L09 HD-06; spec #49 stories 20 to 23, 30
 * to 33, 41, 64, 79, 82). Hội đồng A is gán to the đợt; Hội đồng B to none. Every hồ sơ Tiếp nhận tại tỉnh
 * is Phân công to Thành viên A and Thư ký A (who also holds a Phân vai Thành viên hội đồng on A) as thành
 * viên chấm, and to Tổ tư vấn A as Thành viên Tổ tư vấn. The đợt is dựa trên Tổ tư vấn with 1 người chấm
 * tối thiểu, so Giao chấm takes the hồ sơ to Tổ tư vấn thẩm định.
 */

type Who =
  | "Chủ tịch A"
  | "Thư ký A"
  | "Thư ký A dùng vai Thành viên"
  | "Thành viên A, có Phân công"
  | "Thành viên A, không Phân công"
  | "Tổ tư vấn A, có Phân công"
  | "Tổ tư vấn A, không Phân công"
  | "Chủ tịch B"
  | "Thư ký B"
  | "Quản trị"
  | "Cán bộ Sở"
  | "Chủ thể";
type Outcome = "allowed" | "not_found" | "forbidden" | "invalid_state" | "round_has_score_sheets";

let db: TestDatabase;
let t: TestApp;
let wardX: string;
let f: ReturnType<typeof fixtures>;
const actors = {} as Record<Exclude<Who, "Chủ thể">, UserActor>;

/** Like world() of grading-start: a database of its own per describe, as the đợt's Chế độ chấm locks once. */
function world(gradingMode: "direct" | "advisory_based") {
  const ctx = { setId: "", roundId: "" };
  beforeAll(async () => {
    db = await createTestDatabase();
    t = createTestApp(db, { totpRequired: false });
    await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
    await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n");
    wardX = (await t.app.org.listWards())[0]!.id;
    f = fixtures(t, () => wardX);
    t.clock.set(new Date("2026-10-19T02:00:00Z"));
    const version = await f.publishedVersion("26/2026/QĐ-TTg");
    ctx.setId = version.sets["Rau củ quả"];
    ctx.roundId = await f.openRound(version.versionId, { gradingMode, minGraders: 1 });
    actors["Cán bộ Sở"] = await f.staff("province_officer");
    const a = await f.staffedCouncil(actors["Cán bộ Sở"], { members: 2, advisors: 2 });
    const b = await f.staffedCouncil(actors["Cán bộ Sở"], { members: 1, advisors: 1 });
    await t.app.rounds.assignCouncil(actors["Cán bộ Sở"], { roundId: ctx.roundId, councilId: a.councilId });
    actors["Chủ tịch A"] = a.chair;
    actors["Thư ký A"] = a.secretary;
    actors["Thành viên A, có Phân công"] = a.members[0]!;
    actors["Thành viên A, không Phân công"] = a.members[1]!;
    actors["Tổ tư vấn A, có Phân công"] = a.advisors[0]!;
    actors["Tổ tư vấn A, không Phân công"] = a.advisors[1]!;
    actors["Chủ tịch B"] = b.chair;
    actors["Thư ký B"] = b.secretary;
    actors["Quản trị"] = await f.admin();
    await f.grant(a.secretary, "council_member", a.councilId);
    actors["Thư ký A dùng vai Thành viên"] = await f.asRole(a.secretary, "council_member");
  });
  afterAll(async () => {
    await t.stop();
    await db.drop();
  });
  return ctx;
}

describe("Permission matrix: Giao chấm and who sees a hồ sơ Giao chấm (#14, #53, L09 HD-06, stories 30 to 33, 41, 64, 79, 82)", () => {
  const ctx = world("advisory_based");

  type State = "Đã chuyển tỉnh, chưa tiếp nhận" | "Đã tiếp nhận tại tỉnh" | "Sở trả về sau tiếp nhận" | "Đã Giao chấm";
  type Action = "Giao chấm" | "đọc hồ sơ" | "thấy trong danh sách";

  const MATRIX: [Who, Action, State, Outcome][] = [
    // Giao chấm is the Thư ký's, on a hồ sơ Tiếp nhận tại tỉnh in this lượt (story 32), once.
    ["Thư ký A", "Giao chấm", "Đã chuyển tỉnh, chưa tiếp nhận", "not_found"],
    ["Thư ký A", "Giao chấm", "Đã tiếp nhận tại tỉnh", "allowed"],
    ["Thư ký A", "Giao chấm", "Sở trả về sau tiếp nhận", "invalid_state"],
    ["Thư ký A", "Giao chấm", "Đã Giao chấm", "invalid_state"],
    ["Thư ký B", "Giao chấm", "Đã tiếp nhận tại tỉnh", "not_found"],
    ["Chủ tịch A", "Giao chấm", "Đã tiếp nhận tại tỉnh", "forbidden"],
    // Story 64: the Tổ tư vấn does not Giao chấm; nor does a thành viên, whatever else they hold (story 82).
    ["Tổ tư vấn A, có Phân công", "Giao chấm", "Đã tiếp nhận tại tỉnh", "forbidden"],
    ["Thành viên A, có Phân công", "Giao chấm", "Đã tiếp nhận tại tỉnh", "forbidden"],
    ["Thư ký A dùng vai Thành viên", "Giao chấm", "Đã tiếp nhận tại tỉnh", "forbidden"],
    ["Cán bộ Sở", "Giao chấm", "Đã tiếp nhận tại tỉnh", "forbidden"],
    ["Quản trị", "Giao chấm", "Đã tiếp nhận tại tỉnh", "forbidden"],
    ["Chủ thể", "Giao chấm", "Đã tiếp nhận tại tỉnh", "forbidden"],
    // From Giao chấm on, the people Phân công see the hồ sơ, by the Vai trò of their kind (stories 41, 79, 81).
    ["Thành viên A, có Phân công", "đọc hồ sơ", "Đã tiếp nhận tại tỉnh", "not_found"],
    ["Thành viên A, có Phân công", "đọc hồ sơ", "Đã Giao chấm", "allowed"],
    ["Thành viên A, có Phân công", "thấy trong danh sách", "Đã Giao chấm", "allowed"],
    ["Tổ tư vấn A, có Phân công", "đọc hồ sơ", "Đã tiếp nhận tại tỉnh", "not_found"],
    ["Tổ tư vấn A, có Phân công", "đọc hồ sơ", "Đã Giao chấm", "allowed"],
    ["Tổ tư vấn A, có Phân công", "thấy trong danh sách", "Đã Giao chấm", "allowed"],
    ["Thư ký A dùng vai Thành viên", "đọc hồ sơ", "Đã Giao chấm", "allowed"],
    ["Thành viên A, không Phân công", "đọc hồ sơ", "Đã Giao chấm", "not_found"],
    ["Thành viên A, không Phân công", "thấy trong danh sách", "Đã Giao chấm", "not_found"],
    ["Tổ tư vấn A, không Phân công", "đọc hồ sơ", "Đã Giao chấm", "not_found"],
    ["Tổ tư vấn A, không Phân công", "thấy trong danh sách", "Đã Giao chấm", "not_found"],
    ["Thư ký A", "đọc hồ sơ", "Đã Giao chấm", "allowed"],
    ["Chủ tịch A", "thấy trong danh sách", "Đã Giao chấm", "allowed"],
    ["Thư ký B", "đọc hồ sơ", "Đã Giao chấm", "not_found"],
    ["Chủ tịch B", "thấy trong danh sách", "Đã Giao chấm", "not_found"],
    ["Cán bộ Sở", "đọc hồ sơ", "Đã Giao chấm", "allowed"],
    ["Chủ thể", "đọc hồ sơ", "Đã Giao chấm", "allowed"],
    ["Quản trị", "đọc hồ sơ", "Đã Giao chấm", "forbidden"],
  ];

  interface Subject {
    owner: UserActor;
    dossierId: string;
    version: number;
  }

  async function dossierIn(state: State): Promise<Subject> {
    const ward = await f.staff("ward_officer", wardX);
    if (state === "Đã chuyển tỉnh, chưa tiếp nhận") {
      const s = await f.forwarded(ward, ctx.setId, wardX);
      return { owner: s.a, dossierId: s.dossierId, version: s.version };
    }
    const people = {
      members: [actors["Thành viên A, có Phân công"], actors["Thư ký A"]],
      advisors: [actors["Tổ tư vấn A, có Phân công"]],
    };
    if (state === "Đã Giao chấm") {
      const s = await f.gradingStarted(ward, actors["Cán bộ Sở"], ctx.setId, actors["Thư ký A"], people, wardX);
      return { owner: s.a, dossierId: s.dossierId, version: s.version };
    }
    const s = await f.provinceReceived(ward, actors["Cán bộ Sở"], ctx.setId, wardX);
    let { version } = (
      await t.app.councils.editAssignments(actors["Thư ký A"], {
        dossiers: [{ dossierId: s.dossierId, expectedVersion: s.version }],
        members: people.members.map((m) => m.userId),
        advisors: people.advisors.map((a) => a.userId),
      })
    ).dossiers[0]!;
    if (state === "Sở trả về sau tiếp nhận") {
      ({ version } = await t.app.dossiers.returnFromProvince(actors["Cán bộ Sở"], {
        dossierId: s.dossierId,
        expectedVersion: version,
        deadline: "2026-10-31",
        items: [{ content: "Bổ sung" }],
      }));
    }
    return { owner: s.a, dossierId: s.dossierId, version };
  }

  async function attempt(who: Who, action: Action, d: Subject): Promise<void> {
    const actor = who === "Chủ thể" ? d.owner : actors[who];
    switch (action) {
      case "Giao chấm":
        return void (await t.app.councils.startGrading(actor, { dossiers: [{ dossierId: d.dossierId, expectedVersion: d.version }] }));
      case "đọc hồ sơ":
        return void (await t.app.dossiers.get(actor, { dossierId: d.dossierId }));
      case "thấy trong danh sách":
        if (!(await t.app.dossiers.list(actor)).some((x) => x.id === d.dossierId)) throw Object.assign(new Error("not listed"), { code: "not_found" });
        return;
    }
  }

  it.each(MATRIX)("%s / %s / %s → %s", async (who, action, state, outcome) => {
    const d = await dossierIn(state);
    const result = attempt(who, action, d);
    if (outcome === "allowed") await expect(result).resolves.toBeUndefined();
    else await expect(result).rejects.toMatchObject({ code: outcome });
  });
});

describe("Permission matrix: confirming or changing the Chế độ chấm of the đợt (#14, #53, L09 HD-06, stories 20 to 23)", () => {
  const ctx = world("direct");

  type State = "Đợt chưa có Phiếu chấm" | "Đợt đã có Phiếu chấm";
  // The rows of an open đợt come first: the first row of a locked one Giao chấm a hồ sơ, which is for good.
  const MATRIX: [Who, State, Outcome][] = [
    ["Thư ký A", "Đợt chưa có Phiếu chấm", "allowed"],
    ["Cán bộ Sở", "Đợt chưa có Phiếu chấm", "allowed"],
    ["Thư ký B", "Đợt chưa có Phiếu chấm", "forbidden"],
    ["Chủ tịch A", "Đợt chưa có Phiếu chấm", "forbidden"],
    ["Thành viên A, có Phân công", "Đợt chưa có Phiếu chấm", "forbidden"],
    ["Tổ tư vấn A, có Phân công", "Đợt chưa có Phiếu chấm", "forbidden"],
    ["Thư ký A dùng vai Thành viên", "Đợt chưa có Phiếu chấm", "forbidden"],
    ["Quản trị", "Đợt chưa có Phiếu chấm", "forbidden"],
    ["Thư ký A", "Đợt đã có Phiếu chấm", "round_has_score_sheets"],
    ["Cán bộ Sở", "Đợt đã có Phiếu chấm", "round_has_score_sheets"],
    ["Thư ký B", "Đợt đã có Phiếu chấm", "forbidden"],
  ];
  let locked = false;

  async function lockRound() {
    if (locked) return;
    // Back to chấm trực tiếp (the allowed rows toggle it), then one Giao chấm.
    await t.app.rounds.changeGradingMode(actors["Cán bộ Sở"], { roundId: ctx.roundId, gradingMode: "direct" });
    const ward = await f.staff("ward_officer", wardX);
    await f.gradingStarted(ward, actors["Cán bộ Sở"], ctx.setId, actors["Thư ký A"], { members: [actors["Thành viên A, có Phân công"]] }, wardX);
    locked = true;
  }

  it.each(MATRIX)("%s / đổi Chế độ chấm / %s → %s", async (who, state, outcome) => {
    if (state === "Đợt đã có Phiếu chấm") await lockRound();
    const actor = actors[who as Exclude<Who, "Chủ thể">];
    const current = (await t.app.rounds.getRound(actors["Cán bộ Sở"], { roundId: ctx.roundId })).gradingMode;
    const result = t.app.rounds.changeGradingMode(actor, { roundId: ctx.roundId, gradingMode: current === "direct" ? "advisory_based" : "direct" });
    if (outcome === "allowed") await expect(result).resolves.toBeUndefined();
    else await expect(result).rejects.toMatchObject({ code: outcome });
  });
});
