import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { onBehalfOf, type UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { anonymous, createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, entityIdOf, fixtures, PRODUCT } from "./fixtures";

/*
 * #14 permission matrix for step 3 (spec #30, stories 76, 77, 80 to 82), as data: each row is a Vai trò
 * on a Phạm vi, an action, the state of the hồ sơ of Chủ thể A (registered in xã X) and the expected
 * outcome. Outcomes are the observable ones: allowed, not found (out of Phạm vi), forbidden (Vai trò),
 * or the refusal the transition table gives.
 */

let db: TestDatabase;
let t: TestApp;
let wardX: string;
let wardY: string;
let f: ReturnType<typeof fixtures>;
let criteriaSetId: string;

type Who =
  | "Chủ thể A"
  | "Chủ thể B"
  | "Cán bộ xã X"
  | "Cán bộ xã Y"
  | "Người dùng hai Phân vai, đang là Chủ thể C"
  | "Người dùng hai Phân vai, đang là Cán bộ xã X"
  | "Cán bộ xã X Nhập hộ A"
  | "Cán bộ xã Y Nhập hộ A"
  | "Chủ thể B Nhập hộ A";
type State = "Nháp" | "Đã nộp xã" | "Đã nộp xã, đã Tiếp nhận" | "Đã chuyển từ xã X sang xã Y";
type Action = "đọc hồ sơ" | "thấy trong danh sách" | "dòng thời gian" | "sửa thông tin" | "rút" | "Tiếp nhận" | "đổi Cán bộ phụ trách" | "đọc Chủ thể A" | "đọc hồ sơ pháp lý của A" | "loại" | "Chuyển xã" | "đánh giá Checklist sơ bộ";
type Outcome = "allowed" | "not_found" | "forbidden" | "invalid_state" | "already_received" | "not_received";

const actors = {} as Record<Who, UserActor>;
let secondOfficerX: UserActor;
let ownerA: UserActor;

const MATRIX: [Who, Action, State, Outcome][] = [
  // Chủ thể: only its own hồ sơ and hồ sơ pháp lý (story 76).
  ["Chủ thể A", "đọc hồ sơ", "Nháp", "allowed"],
  ["Chủ thể A", "đọc hồ sơ", "Đã nộp xã", "allowed"],
  ["Chủ thể A", "dòng thời gian", "Đã nộp xã, đã Tiếp nhận", "allowed"],
  ["Chủ thể A", "sửa thông tin", "Nháp", "allowed"],
  ["Chủ thể A", "sửa thông tin", "Đã nộp xã", "invalid_state"],
  ["Chủ thể A", "rút", "Đã nộp xã", "allowed"],
  ["Chủ thể A", "rút", "Đã nộp xã, đã Tiếp nhận", "already_received"],
  ["Chủ thể A", "Tiếp nhận", "Đã nộp xã", "forbidden"],
  ["Chủ thể A", "đổi Cán bộ phụ trách", "Đã nộp xã, đã Tiếp nhận", "forbidden"],
  ["Chủ thể A", "đánh giá Checklist sơ bộ", "Đã nộp xã, đã Tiếp nhận", "forbidden"],
  ["Chủ thể B", "đọc hồ sơ", "Đã nộp xã", "not_found"],
  ["Chủ thể B", "thấy trong danh sách", "Đã nộp xã", "not_found"],
  ["Chủ thể B", "rút", "Đã nộp xã", "not_found"],
  ["Chủ thể B", "đọc Chủ thể A", "Đã nộp xã", "not_found"],
  ["Chủ thể B", "đọc hồ sơ pháp lý của A", "Đã nộp xã", "not_found"],
  // Cán bộ xã: the hồ sơ whose xã is theirs, whatever the Cán bộ phụ trách (stories 43, 77, 80).
  ["Cán bộ xã X", "đọc hồ sơ", "Nháp", "not_found"],
  ["Cán bộ xã X", "đọc hồ sơ", "Đã nộp xã", "allowed"],
  ["Cán bộ xã X", "thấy trong danh sách", "Đã nộp xã", "allowed"],
  ["Cán bộ xã X", "dòng thời gian", "Đã nộp xã", "allowed"],
  ["Cán bộ xã X", "Tiếp nhận", "Đã nộp xã", "allowed"],
  ["Cán bộ xã X", "Tiếp nhận", "Đã nộp xã, đã Tiếp nhận", "already_received"],
  ["Cán bộ xã X", "đổi Cán bộ phụ trách", "Đã nộp xã", "not_received"],
  ["Cán bộ xã X", "đổi Cán bộ phụ trách", "Đã nộp xã, đã Tiếp nhận", "allowed"],
  ["Cán bộ xã X", "đánh giá Checklist sơ bộ", "Đã nộp xã", "not_received"],
  ["Cán bộ xã X", "đánh giá Checklist sơ bộ", "Đã nộp xã, đã Tiếp nhận", "allowed"],
  ["Cán bộ xã X", "sửa thông tin", "Đã nộp xã", "forbidden"],
  ["Cán bộ xã X", "rút", "Đã nộp xã", "forbidden"],
  ["Cán bộ xã X", "đọc Chủ thể A", "Đã nộp xã", "allowed"],
  ["Cán bộ xã X", "đọc hồ sơ pháp lý của A", "Đã nộp xã", "allowed"],
  ["Cán bộ xã Y", "đọc hồ sơ", "Đã nộp xã", "not_found"],
  ["Cán bộ xã Y", "thấy trong danh sách", "Đã nộp xã", "not_found"],
  ["Cán bộ xã Y", "dòng thời gian", "Đã nộp xã", "not_found"],
  ["Cán bộ xã Y", "Tiếp nhận", "Đã nộp xã", "not_found"],
  ["Cán bộ xã Y", "đổi Cán bộ phụ trách", "Đã nộp xã, đã Tiếp nhận", "not_found"],
  ["Cán bộ xã Y", "đánh giá Checklist sơ bộ", "Đã nộp xã, đã Tiếp nhận", "not_found"],
  ["Cán bộ xã Y", "đọc Chủ thể A", "Đã nộp xã", "not_found"],
  ["Cán bộ xã Y", "đọc hồ sơ pháp lý của A", "Đã nộp xã", "not_found"],
  // The Phạm vi follows the Vai trò đang dùng, never another Phân vai of the same person (story 82).
  ["Người dùng hai Phân vai, đang là Chủ thể C", "đọc hồ sơ", "Đã nộp xã", "not_found"],
  ["Người dùng hai Phân vai, đang là Chủ thể C", "thấy trong danh sách", "Đã nộp xã", "not_found"],
  ["Người dùng hai Phân vai, đang là Chủ thể C", "Tiếp nhận", "Đã nộp xã", "not_found"],
  ["Người dùng hai Phân vai, đang là Chủ thể C", "đọc Chủ thể A", "Đã nộp xã", "not_found"],
  ["Người dùng hai Phân vai, đang là Cán bộ xã X", "đọc hồ sơ", "Đã nộp xã", "allowed"],
  ["Người dùng hai Phân vai, đang là Cán bộ xã X", "thấy trong danh sách", "Đã nộp xã", "allowed"],
  ["Người dùng hai Phân vai, đang là Cán bộ xã X", "Tiếp nhận", "Đã nộp xã", "allowed"],
  ["Người dùng hai Phân vai, đang là Cán bộ xã X", "rút", "Đã nộp xã", "forbidden"],
  // L05 XA-06 loại and Chuyển xã: the Cán bộ xã of the hồ sơ's xã only (stories 47 to 49, 63).
  ["Chủ thể A", "loại", "Đã nộp xã", "forbidden"],
  ["Chủ thể A", "Chuyển xã", "Đã nộp xã", "forbidden"],
  ["Cán bộ xã X", "loại", "Nháp", "not_found"],
  ["Cán bộ xã X", "loại", "Đã nộp xã", "not_received"],
  ["Cán bộ xã X", "loại", "Đã nộp xã, đã Tiếp nhận", "allowed"],
  ["Cán bộ xã X", "Chuyển xã", "Đã nộp xã", "allowed"],
  ["Cán bộ xã X", "Chuyển xã", "Đã nộp xã, đã Tiếp nhận", "allowed"],
  ["Cán bộ xã Y", "loại", "Đã nộp xã", "not_found"],
  ["Cán bộ xã Y", "Chuyển xã", "Đã nộp xã", "not_found"],
  // After Chuyển xã the xã it left loses it and the xã it went to has it (story 49).
  ["Cán bộ xã X", "đọc hồ sơ", "Đã chuyển từ xã X sang xã Y", "not_found"],
  ["Cán bộ xã X", "thấy trong danh sách", "Đã chuyển từ xã X sang xã Y", "not_found"],
  ["Cán bộ xã X", "Tiếp nhận", "Đã chuyển từ xã X sang xã Y", "not_found"],
  ["Cán bộ xã Y", "đọc hồ sơ", "Đã chuyển từ xã X sang xã Y", "allowed"],
  ["Cán bộ xã Y", "thấy trong danh sách", "Đã chuyển từ xã X sang xã Y", "allowed"],
  ["Cán bộ xã Y", "Tiếp nhận", "Đã chuyển từ xã X sang xã Y", "allowed"],
  ["Cán bộ xã Y", "đọc hồ sơ pháp lý của A", "Đã chuyển từ xã X sang xã Y", "allowed"],
  ["Chủ thể A", "đọc hồ sơ", "Đã chuyển từ xã X sang xã Y", "allowed"],
  // L01 Nhập hộ: only the Cán bộ xã of the xã đăng ký of A, only the Chủ thể's own steps (stories 72, 75).
  ["Cán bộ xã X Nhập hộ A", "đọc hồ sơ", "Nháp", "allowed"],
  ["Cán bộ xã X Nhập hộ A", "thấy trong danh sách", "Nháp", "allowed"],
  ["Cán bộ xã X Nhập hộ A", "sửa thông tin", "Nháp", "allowed"],
  ["Cán bộ xã X Nhập hộ A", "sửa thông tin", "Đã nộp xã", "invalid_state"],
  ["Cán bộ xã X Nhập hộ A", "rút", "Đã nộp xã", "forbidden"],
  ["Cán bộ xã X Nhập hộ A", "Tiếp nhận", "Đã nộp xã", "forbidden"],
  ["Cán bộ xã X Nhập hộ A", "loại", "Đã nộp xã", "forbidden"],
  ["Cán bộ xã X Nhập hộ A", "đọc Chủ thể A", "Nháp", "forbidden"],
  ["Cán bộ xã Y Nhập hộ A", "đọc hồ sơ", "Nháp", "not_found"],
  ["Cán bộ xã Y Nhập hộ A", "sửa thông tin", "Nháp", "not_found"],
  ["Cán bộ xã Y Nhập hộ A", "đọc hồ sơ", "Đã chuyển từ xã X sang xã Y", "not_found"],
  ["Cán bộ xã Y Nhập hộ A", "thấy trong danh sách", "Đã chuyển từ xã X sang xã Y", "not_found"],
  ["Chủ thể B Nhập hộ A", "sửa thông tin", "Nháp", "forbidden"],
];

/** A fresh hồ sơ of Chủ thể A in the given state; returns its id and current version. */
async function dossierIn(state: State): Promise<{ dossierId: string; version: number }> {
  const { dossierId } = await t.app.dossiers.create(ownerA, { criteriaSetId });
  if (state === "Nháp") return { dossierId, version: (await t.app.dossiers.get(ownerA, { dossierId })).version };
  const ready = await f.completeDraft(ownerA, dossierId);
  const { version } = await t.app.dossiers.submit(ownerA, { dossierId, expectedVersion: ready });
  if (state === "Đã nộp xã") return { dossierId, version };
  if (state === "Đã chuyển từ xã X sang xã Y") {
    const moved = await t.app.dossiers.transferWard(actors["Cán bộ xã X"], { dossierId, expectedVersion: version, wardId: wardY, reason: "Sai địa bàn" });
    return { dossierId, version: moved.version };
  }
  return { dossierId, version: (await t.app.dossiers.receive(actors["Cán bộ xã X"], { dossierId, expectedVersion: version })).version };
}

async function attempt(actor: UserActor, action: Action, d: { dossierId: string; version: number }): Promise<void> {
  const { dossierId, version: expectedVersion } = d;
  const entityId = ownerA.activeScope!.id!;
  switch (action) {
    case "đọc hồ sơ":
      return void (await t.app.dossiers.get(actor, { dossierId }));
    case "thấy trong danh sách":
      if (!(await t.app.dossiers.list(actor)).some((x) => x.id === dossierId)) throw Object.assign(new Error("not listed"), { code: "not_found" });
      return;
    case "dòng thời gian":
      return void (await t.app.dossiers.timeline(actor, { dossierId }));
    case "sửa thông tin":
      return void (await t.app.dossiers.updateProduct(actor, { dossierId, expectedVersion, productName: PRODUCT.productName }));
    case "rút":
      return void (await t.app.dossiers.withdraw(actor, { dossierId, expectedVersion, reason: "Thử quyền" }));
    case "Tiếp nhận":
      return void (await t.app.dossiers.receive(actor, { dossierId, expectedVersion }));
    case "đổi Cán bộ phụ trách":
      return void (await t.app.dossiers.changeHandler(actor, { dossierId, expectedVersion, handlerUserId: secondOfficerX.userId }));
    case "đọc Chủ thể A":
      return void (await t.app.entities.getEntity(actor, { entityId }));
    case "đọc hồ sơ pháp lý của A":
      return void (await t.app.entities.getLegalStanding(actor, { entityId }));
    case "loại":
      return void (await t.app.dossiers.reject(actor, { dossierId, expectedVersion, reasonCode: "other", explanation: "Thử quyền" }));
    case "Chuyển xã":
      return void (await t.app.dossiers.transferWard(actor, { dossierId, expectedVersion, wardId: wardY, reason: "Thử quyền" }));
    case "đánh giá Checklist sơ bộ": {
      const [item] = (await t.app.dossiers.checklist(ownerA, { dossierId })).items;
      return void (await t.app.dossiers.assessChecklist(actor, { dossierId, expectedVersion, results: [{ itemCode: item!.code, result: "pass" }] }));
    }
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
  const version = await f.publishedVersion("26/2026/QĐ-TTg");
  criteriaSetId = version.sets["Rau củ quả"];
  await f.openRound(version.versionId);

  ownerA = await f.verifiedOwner(wardX);
  actors["Chủ thể A"] = ownerA;
  actors["Chủ thể B"] = await f.verifiedOwner(wardY);
  actors["Cán bộ xã X"] = await f.staff("ward_officer", wardX);
  actors["Cán bộ xã Y"] = await f.staff("ward_officer", wardY);
  secondOfficerX = await f.staff("ward_officer", wardX);

  // Chủ thể C, of xã Y, whose Người dùng đại diện is also a Cán bộ xã of X.
  const c = await f.verifiedOwner(wardY);
  await t.app.identity.grantRole(await f.admin(), { userId: c.userId, role: "ward_officer", scopeId: wardX });
  const asRole = async (role: "entity_owner" | "ward_officer") => {
    const { actor, token } = await t.signInWithToken(c.email, "mat-khau-nguoi-dung-1");
    const target = (await t.app.identity.myAssignments(actor)).find((a) => a.role === role)!;
    await t.app.identity.switchActiveRole(actor, { assignmentId: target.id });
    return (await t.app.identity.authenticate(anonymous(), { sessionToken: token }))!;
  };
  actors["Người dùng hai Phân vai, đang là Chủ thể C"] = await asRole("entity_owner");
  actors["Người dùng hai Phân vai, đang là Cán bộ xã X"] = await asRole("ward_officer");
  actors["Cán bộ xã X Nhập hộ A"] = onBehalfOf(actors["Cán bộ xã X"], entityIdOf(ownerA));
  actors["Cán bộ xã Y Nhập hộ A"] = onBehalfOf(actors["Cán bộ xã Y"], entityIdOf(ownerA));
  actors["Chủ thể B Nhập hộ A"] = onBehalfOf(actors["Chủ thể B"], entityIdOf(ownerA));
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("Permission matrix: Chủ thể and Cán bộ xã on hồ sơ (#14, L01, L03, L05, stories 72, 75, 76, 77, 80 to 82)", () => {
  it.each(MATRIX)("%s / %s / %s → %s", async (who, action, state, outcome) => {
    const d = await dossierIn(state);
    const result = attempt(actors[who], action, d);
    if (outcome === "allowed") await expect(result).resolves.toBeUndefined();
    else await expect(result).rejects.toMatchObject({ code: outcome });
  });
});
