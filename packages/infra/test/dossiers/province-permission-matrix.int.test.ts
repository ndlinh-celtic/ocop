import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, entityIdOf, fixtures } from "./fixtures";

/*
 * #14 permission matrix rows for the Cán bộ Sở and Quản trị (#44, spec #30 stories 57 to 59, 78, 79, 83),
 * beside the Chủ thể and Cán bộ xã rows of permission-matrix.int.test.ts. Each row: who, action, state of
 * a hồ sơ of Chủ thể A (registered in xã X), expected outcome.
 */

let db: TestDatabase;
let t: TestApp;
let wardX: string;
let wardY: string;
let f: ReturnType<typeof fixtures>;
let setId: string;

type Who = "Cán bộ Sở" | "Quản trị" | "Cán bộ xã X" | "Cán bộ xã Y" | "Chủ thể A";
type State = "Đã nộp xã" | "Đã chuyển tỉnh" | "Sở trả về, Yêu cầu bổ sung";
type Action =
  | "đọc hồ sơ"
  | "thấy trong danh sách"
  | "dòng thời gian"
  | "đọc Chủ thể A"
  | "đọc hồ sơ pháp lý của A"
  | "tải Phiếu đăng ký"
  | "yêu cầu bổ sung đã có"
  | "Tiếp nhận"
  | "gửi tỉnh"
  | "trả về"
  | "đề nghị trả về"
  | "xem đề nghị trả về";
type Outcome = "allowed" | "not_found" | "forbidden" | "invalid_state";

const actors = {} as Record<Who, UserActor>;

const MATRIX: [Who, Action, State, Outcome][] = [
  // Cán bộ Sở: only what has reached the province, from then on (stories 78, 79).
  ["Cán bộ Sở", "đọc hồ sơ", "Đã nộp xã", "not_found"],
  ["Cán bộ Sở", "thấy trong danh sách", "Đã nộp xã", "not_found"],
  ["Cán bộ Sở", "dòng thời gian", "Đã nộp xã", "not_found"],
  ["Cán bộ Sở", "đọc Chủ thể A", "Đã nộp xã", "not_found"],
  ["Cán bộ Sở", "tải Phiếu đăng ký", "Đã nộp xã", "not_found"],
  ["Cán bộ Sở", "trả về", "Đã nộp xã", "not_found"],
  ["Cán bộ Sở", "đọc hồ sơ", "Đã chuyển tỉnh", "allowed"],
  ["Cán bộ Sở", "thấy trong danh sách", "Đã chuyển tỉnh", "allowed"],
  ["Cán bộ Sở", "dòng thời gian", "Đã chuyển tỉnh", "allowed"],
  ["Cán bộ Sở", "đọc Chủ thể A", "Đã chuyển tỉnh", "allowed"],
  ["Cán bộ Sở", "đọc hồ sơ pháp lý của A", "Đã chuyển tỉnh", "allowed"],
  ["Cán bộ Sở", "tải Phiếu đăng ký", "Đã chuyển tỉnh", "allowed"],
  ["Cán bộ Sở", "xem đề nghị trả về", "Đã chuyển tỉnh", "allowed"],
  ["Cán bộ Sở", "trả về", "Đã chuyển tỉnh", "allowed"],
  ["Cán bộ Sở", "Tiếp nhận", "Đã chuyển tỉnh", "forbidden"],
  ["Cán bộ Sở", "gửi tỉnh", "Đã chuyển tỉnh", "forbidden"],
  ["Cán bộ Sở", "đề nghị trả về", "Đã chuyển tỉnh", "forbidden"],
  ["Cán bộ Sở", "đọc hồ sơ", "Sở trả về, Yêu cầu bổ sung", "allowed"],
  ["Cán bộ Sở", "thấy trong danh sách", "Sở trả về, Yêu cầu bổ sung", "allowed"],
  ["Cán bộ Sở", "yêu cầu bổ sung đã có", "Sở trả về, Yêu cầu bổ sung", "allowed"],
  ["Cán bộ Sở", "trả về", "Sở trả về, Yêu cầu bổ sung", "invalid_state"],
  // Quản trị: a technical Vai trò, no business data (story 83).
  ["Quản trị", "đọc hồ sơ", "Đã nộp xã", "forbidden"],
  ["Quản trị", "đọc hồ sơ", "Đã chuyển tỉnh", "forbidden"],
  ["Quản trị", "thấy trong danh sách", "Đã chuyển tỉnh", "forbidden"],
  ["Quản trị", "dòng thời gian", "Đã chuyển tỉnh", "forbidden"],
  ["Quản trị", "đọc Chủ thể A", "Đã chuyển tỉnh", "forbidden"],
  ["Quản trị", "đọc hồ sơ pháp lý của A", "Đã chuyển tỉnh", "forbidden"],
  ["Quản trị", "tải Phiếu đăng ký", "Đã chuyển tỉnh", "forbidden"],
  ["Quản trị", "yêu cầu bổ sung đã có", "Sở trả về, Yêu cầu bổ sung", "forbidden"],
  ["Quản trị", "xem đề nghị trả về", "Đã chuyển tỉnh", "forbidden"],
  ["Quản trị", "trả về", "Đã chuyển tỉnh", "forbidden"],
  // The xã keeps its hồ sơ after gửi tỉnh and may only ask for a trả về (story 59).
  ["Cán bộ xã X", "đọc hồ sơ", "Đã chuyển tỉnh", "allowed"],
  ["Cán bộ xã X", "trả về", "Đã chuyển tỉnh", "forbidden"],
  ["Cán bộ xã X", "đề nghị trả về", "Đã chuyển tỉnh", "allowed"],
  ["Cán bộ xã X", "xem đề nghị trả về", "Đã chuyển tỉnh", "allowed"],
  ["Cán bộ xã X", "đề nghị trả về", "Đã nộp xã", "invalid_state"],
  ["Cán bộ xã X", "đề nghị trả về", "Sở trả về, Yêu cầu bổ sung", "invalid_state"],
  ["Cán bộ xã X", "đọc hồ sơ", "Sở trả về, Yêu cầu bổ sung", "allowed"],
  ["Cán bộ xã Y", "đề nghị trả về", "Đã chuyển tỉnh", "not_found"],
  ["Cán bộ xã Y", "xem đề nghị trả về", "Đã chuyển tỉnh", "not_found"],
  ["Chủ thể A", "trả về", "Đã chuyển tỉnh", "forbidden"],
  ["Chủ thể A", "đề nghị trả về", "Đã chuyển tỉnh", "forbidden"],
  ["Chủ thể A", "xem đề nghị trả về", "Đã chuyển tỉnh", "forbidden"],
];

interface Subject {
  owner: UserActor;
  dossierId: string;
  version: number;
}

async function dossierIn(state: State): Promise<Subject> {
  if (state === "Đã nộp xã") {
    const s = await f.submitted(setId, wardX);
    return { owner: s.a, dossierId: s.dossierId, version: s.version };
  }
  const s = await f.forwarded(actors["Cán bộ xã X"], setId, wardX);
  if (state === "Đã chuyển tỉnh") return { owner: s.a, dossierId: s.dossierId, version: s.version };
  const { version } = await t.app.dossiers.returnFromProvince(actors["Cán bộ Sở"], {
    dossierId: s.dossierId,
    expectedVersion: s.version,
    deadline: "2026-10-31",
    items: [{ content: "Bổ sung" }],
  });
  return { owner: s.a, dossierId: s.dossierId, version };
}

async function attempt(who: Who, action: Action, d: Subject): Promise<void> {
  // "Chủ thể A" is the owner of the hồ sơ under test.
  const actor = who === "Chủ thể A" ? d.owner : actors[who];
  const { dossierId, version: expectedVersion } = d;
  const entityId = entityIdOf(d.owner);
  switch (action) {
    case "đọc hồ sơ":
      return void (await t.app.dossiers.get(actor, { dossierId }));
    case "thấy trong danh sách":
      if (!(await t.app.dossiers.list(actor)).some((x) => x.id === dossierId)) throw Object.assign(new Error("not listed"), { code: "not_found" });
      return;
    case "dòng thời gian":
      return void (await t.app.dossiers.timeline(actor, { dossierId }));
    case "đọc Chủ thể A":
      return void (await t.app.entities.getEntity(actor, { entityId }));
    case "đọc hồ sơ pháp lý của A":
      return void (await t.app.entities.getLegalStanding(actor, { entityId }));
    case "tải Phiếu đăng ký":
      return void (await t.app.dossiers.downloadSubmissionDocument(actor, { dossierId, submissionNumber: 1, document: "registration_form" }));
    case "yêu cầu bổ sung đã có":
      return void (await t.app.dossiers.supplementRequests(actor, { dossierId }));
    case "Tiếp nhận":
      return void (await t.app.dossiers.receive(actor, { dossierId, expectedVersion }));
    case "gửi tỉnh":
      return void (await t.app.dossiers.forwardToProvince(actor, { dossierId, expectedVersion }));
    case "trả về":
      return void (await t.app.dossiers.returnFromProvince(actor, { dossierId, expectedVersion, deadline: "2026-10-31", items: [{ content: "Thử quyền" }] }));
    case "đề nghị trả về":
      return void (await t.app.dossiers.requestReturn(actor, { dossierId, expectedVersion, reason: "Thử quyền" }));
    case "xem đề nghị trả về":
      return void (await t.app.dossiers.returnRequests(actor, { dossierId }));
  }
}

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n00002,Xã Bình Lợi\n");
  const wards = await t.app.org.listWards();
  wardX = wards.find((w) => w.name === "Xã An Phú")!.id;
  wardY = wards.find((w) => w.name === "Xã Bình Lợi")!.id;
  f = fixtures(t, () => wardX);
  t.clock.set(new Date("2026-10-19T02:00:00Z"));
  const version = await f.publishedVersion("26/2026/QĐ-TTg");
  setId = version.sets["Rau củ quả"];
  await f.openRound(version.versionId);
  actors["Cán bộ Sở"] = await f.staff("province_officer");
  actors["Quản trị"] = await f.admin();
  actors["Cán bộ xã X"] = await f.staff("ward_officer", wardX);
  actors["Cán bộ xã Y"] = await f.staff("ward_officer", wardY);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("Permission matrix: Cán bộ Sở and Quản trị on hồ sơ (#14, L04, L06, stories 57 to 59, 78, 79, 83)", () => {
  it.each(MATRIX)("%s / %s / %s → %s", async (who, action, state, outcome) => {
    const d = await dossierIn(state);
    const result = attempt(who, action, d);
    if (outcome === "allowed") await expect(result).resolves.toBeUndefined();
    else await expect(result).rejects.toMatchObject({ code: outcome });
  });

  it("Quản trị and the Cán bộ xã have no số liệu tổng hợp; the Cán bộ Sở has it (story 79)", async () => {
    await expect(t.app.dossiers.provinceOverview(actors["Quản trị"])).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.dossiers.provinceOverview(actors["Cán bộ xã X"])).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.dossiers.provinceOverview(actors["Cán bộ Sở"])).resolves.toBeInstanceOf(Array);
  });
});
