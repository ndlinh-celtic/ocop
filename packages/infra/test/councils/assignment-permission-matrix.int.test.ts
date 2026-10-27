import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "../dossiers/fixtures";

/*
 * #14 permission matrix rows for the four Vai trò hội đồng (#52, L09 HD-02, HD-03; spec #49 stories 24 to
 * 29, 41, 79, 82, 83), beside the Chủ thể, xã and Sở rows. Hội đồng A is gán to the đợt of every hồ sơ
 * under test; Hội đồng B to none. Each row: who, action, state of the hồ sơ, expected outcome. Every hồ sơ
 * Tiếp nhận tại tỉnh carries a Phân công nháp: Thành viên A as thành viên chấm, Tổ tư vấn A as Thành viên
 * Tổ tư vấn, and Thư ký A, who also holds a Phân vai Thành viên hội đồng on A, as thành viên chấm.
 */

let db: TestDatabase;
let t: TestApp;
let wardX: string;
let f: ReturnType<typeof fixtures>;
let setId: string;

type Who =
  | "Chủ tịch A"
  | "Thư ký A"
  | "Thư ký A dùng vai Thành viên"
  | "Thành viên A, Phân công nháp"
  | "Thành viên A, không Phân công"
  | "Tổ tư vấn A, Phân công nháp"
  | "Chủ tịch B"
  | "Thư ký B"
  | "Quản trị"
  | "Cán bộ Sở"
  | "Chủ thể";
type State = "Đã nộp xã" | "Đã chuyển tỉnh, chưa tiếp nhận" | "Đã tiếp nhận tại tỉnh" | "Sở trả về sau tiếp nhận";
type Action = "đọc hồ sơ" | "thấy trong danh sách" | "dòng thời gian" | "soạn Phân công" | "xem Phân công";
type Outcome = "allowed" | "not_found" | "forbidden" | "invalid_state";

const actors = {} as Record<Exclude<Who, "Chủ thể">, UserActor>;
let memberA2: UserActor;

const MATRIX: [Who, Action, State, Outcome][] = [
  // Thư ký: the hồ sơ of the đợt of its Hội đồng, from the first Tiếp nhận tại tỉnh on (story 24).
  ["Thư ký A", "đọc hồ sơ", "Đã nộp xã", "not_found"],
  ["Thư ký A", "đọc hồ sơ", "Đã chuyển tỉnh, chưa tiếp nhận", "not_found"],
  ["Thư ký A", "thấy trong danh sách", "Đã chuyển tỉnh, chưa tiếp nhận", "not_found"],
  ["Thư ký A", "soạn Phân công", "Đã chuyển tỉnh, chưa tiếp nhận", "not_found"],
  ["Thư ký A", "đọc hồ sơ", "Đã tiếp nhận tại tỉnh", "allowed"],
  ["Thư ký A", "thấy trong danh sách", "Đã tiếp nhận tại tỉnh", "allowed"],
  ["Thư ký A", "dòng thời gian", "Đã tiếp nhận tại tỉnh", "allowed"],
  ["Thư ký A", "soạn Phân công", "Đã tiếp nhận tại tỉnh", "allowed"],
  ["Thư ký A", "xem Phân công", "Đã tiếp nhận tại tỉnh", "allowed"],
  ["Thư ký A", "đọc hồ sơ", "Sở trả về sau tiếp nhận", "allowed"],
  ["Thư ký A", "thấy trong danh sách", "Sở trả về sau tiếp nhận", "allowed"],
  ["Thư ký A", "soạn Phân công", "Sở trả về sau tiếp nhận", "invalid_state"],
  // Chủ tịch: sees what its Thư ký sees, but Phân công is the Thư ký's.
  ["Chủ tịch A", "đọc hồ sơ", "Đã chuyển tỉnh, chưa tiếp nhận", "not_found"],
  ["Chủ tịch A", "đọc hồ sơ", "Đã tiếp nhận tại tỉnh", "allowed"],
  ["Chủ tịch A", "thấy trong danh sách", "Đã tiếp nhận tại tỉnh", "allowed"],
  ["Chủ tịch A", "xem Phân công", "Đã tiếp nhận tại tỉnh", "allowed"],
  ["Chủ tịch A", "soạn Phân công", "Đã tiếp nhận tại tỉnh", "forbidden"],
  // Another Hội đồng sees nothing of the đợt gán to A.
  ["Thư ký B", "đọc hồ sơ", "Đã tiếp nhận tại tỉnh", "not_found"],
  ["Thư ký B", "thấy trong danh sách", "Đã tiếp nhận tại tỉnh", "not_found"],
  ["Thư ký B", "dòng thời gian", "Đã tiếp nhận tại tỉnh", "not_found"],
  ["Thư ký B", "soạn Phân công", "Đã tiếp nhận tại tỉnh", "not_found"],
  ["Thư ký B", "xem Phân công", "Đã tiếp nhận tại tỉnh", "not_found"],
  ["Chủ tịch B", "đọc hồ sơ", "Đã tiếp nhận tại tỉnh", "not_found"],
  ["Chủ tịch B", "thấy trong danh sách", "Đã tiếp nhận tại tỉnh", "not_found"],
  // A Phân công nháp gives no sight of the hồ sơ, even by its id (stories 41, 79).
  ["Thành viên A, Phân công nháp", "đọc hồ sơ", "Đã tiếp nhận tại tỉnh", "not_found"],
  ["Thành viên A, Phân công nháp", "thấy trong danh sách", "Đã tiếp nhận tại tỉnh", "not_found"],
  ["Thành viên A, Phân công nháp", "dòng thời gian", "Đã tiếp nhận tại tỉnh", "not_found"],
  ["Thành viên A, Phân công nháp", "soạn Phân công", "Đã tiếp nhận tại tỉnh", "forbidden"],
  ["Thành viên A, Phân công nháp", "xem Phân công", "Đã tiếp nhận tại tỉnh", "forbidden"],
  ["Thành viên A, không Phân công", "đọc hồ sơ", "Đã tiếp nhận tại tỉnh", "not_found"],
  ["Thành viên A, không Phân công", "thấy trong danh sách", "Đã tiếp nhận tại tỉnh", "not_found"],
  ["Tổ tư vấn A, Phân công nháp", "đọc hồ sơ", "Đã tiếp nhận tại tỉnh", "not_found"],
  ["Tổ tư vấn A, Phân công nháp", "thấy trong danh sách", "Đã tiếp nhận tại tỉnh", "not_found"],
  ["Tổ tư vấn A, Phân công nháp", "soạn Phân công", "Đã tiếp nhận tại tỉnh", "forbidden"],
  // Two Phân vai on one Hội đồng: what is seen follows the Vai trò đang dùng only (story 82).
  ["Thư ký A dùng vai Thành viên", "đọc hồ sơ", "Đã tiếp nhận tại tỉnh", "not_found"],
  ["Thư ký A dùng vai Thành viên", "thấy trong danh sách", "Đã tiếp nhận tại tỉnh", "not_found"],
  ["Thư ký A dùng vai Thành viên", "soạn Phân công", "Đã tiếp nhận tại tỉnh", "forbidden"],
  // Quản trị sees no hồ sơ (story 83); the Sở and the Chủ thể do not Phân công.
  ["Quản trị", "đọc hồ sơ", "Đã tiếp nhận tại tỉnh", "forbidden"],
  ["Quản trị", "thấy trong danh sách", "Đã tiếp nhận tại tỉnh", "forbidden"],
  ["Quản trị", "soạn Phân công", "Đã tiếp nhận tại tỉnh", "forbidden"],
  ["Quản trị", "xem Phân công", "Đã tiếp nhận tại tỉnh", "forbidden"],
  ["Cán bộ Sở", "soạn Phân công", "Đã tiếp nhận tại tỉnh", "forbidden"],
  ["Cán bộ Sở", "xem Phân công", "Đã tiếp nhận tại tỉnh", "forbidden"],
  ["Chủ thể", "soạn Phân công", "Đã tiếp nhận tại tỉnh", "forbidden"],
  ["Chủ thể", "xem Phân công", "Đã tiếp nhận tại tỉnh", "forbidden"],
];

interface Subject {
  owner: UserActor;
  dossierId: string;
  version: number;
}

async function dossierIn(state: State): Promise<Subject> {
  const ward = await f.staff("ward_officer", wardX);
  if (state === "Đã nộp xã") {
    const s = await f.submitted(setId, wardX);
    return { owner: s.a, dossierId: s.dossierId, version: s.version };
  }
  if (state === "Đã chuyển tỉnh, chưa tiếp nhận") {
    const s = await f.forwarded(ward, setId, wardX);
    return { owner: s.a, dossierId: s.dossierId, version: s.version };
  }
  const s = await f.provinceReceived(ward, actors["Cán bộ Sở"], setId, wardX);
  let { version } = await t.app.councils
    .editAssignments(actors["Thư ký A"], {
      dossiers: [{ dossierId: s.dossierId, expectedVersion: s.version }],
      members: [actors["Thành viên A, Phân công nháp"].userId, actors["Thư ký A"].userId],
      advisors: [actors["Tổ tư vấn A, Phân công nháp"].userId],
    })
    .then((r) => r.dossiers[0]!);
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
  const { dossierId, version: expectedVersion } = d;
  switch (action) {
    case "đọc hồ sơ":
      return void (await t.app.dossiers.get(actor, { dossierId }));
    case "thấy trong danh sách":
      if (!(await t.app.dossiers.list(actor)).some((x) => x.id === dossierId)) throw Object.assign(new Error("not listed"), { code: "not_found" });
      return;
    case "dòng thời gian":
      return void (await t.app.dossiers.timeline(actor, { dossierId }));
    case "soạn Phân công":
      return void (await t.app.councils.editAssignments(actor, { dossiers: [{ dossierId, expectedVersion }], members: [memberA2.userId], advisors: [] }));
    case "xem Phân công":
      return void (await t.app.councils.assignments(actor, { dossierId }));
  }
}

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n");
  wardX = (await t.app.org.listWards())[0]!.id;
  f = fixtures(t, () => wardX);
  t.clock.set(new Date("2026-10-19T02:00:00Z"));
  const version = await f.publishedVersion("26/2026/QĐ-TTg");
  setId = version.sets["Rau củ quả"];
  const roundId = await f.openRound(version.versionId);
  actors["Cán bộ Sở"] = await f.staff("province_officer");
  const a = await f.staffedCouncil(actors["Cán bộ Sở"], { members: 3, advisors: 1 });
  const b = await f.staffedCouncil(actors["Cán bộ Sở"], { members: 1, advisors: 1 });
  await t.app.rounds.assignCouncil(actors["Cán bộ Sở"], { roundId, councilId: a.councilId });
  actors["Chủ tịch A"] = a.chair;
  actors["Thư ký A"] = a.secretary;
  actors["Thành viên A, Phân công nháp"] = a.members[0]!;
  actors["Thành viên A, không Phân công"] = a.members[1]!;
  memberA2 = a.members[2]!;
  actors["Tổ tư vấn A, Phân công nháp"] = a.advisors[0]!;
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

describe("Permission matrix: Vai trò hội đồng on hồ sơ and Phân công (#14, #52, L09 HD-02, stories 24 to 29, 41, 79, 82, 83)", () => {
  it.each(MATRIX)("%s / %s / %s → %s", async (who, action, state, outcome) => {
    const d = await dossierIn(state);
    const result = attempt(who, action, d);
    if (outcome === "allowed") await expect(result).resolves.toBeUndefined();
    else await expect(result).rejects.toMatchObject({ code: outcome });
  });
});
