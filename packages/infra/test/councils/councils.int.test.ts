import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "../dossiers/fixtures";

/*
 * L09 HD-01 (#50, spec #49 stories 1 to 12): Cán bộ Sở records a Hội đồng and its Tổ trưởng, and assigns
 * it to a Đợt đánh giá; Quản trị grants the Phân vai on its Phạm vi, which are its only member list.
 */

let db: TestDatabase;
let t: TestApp;
let f: ReturnType<typeof fixtures>;
let province: UserActor;
const START = new Date("2026-10-19T02:00:00Z");

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n");
  const wardId = (await t.app.org.listWards())[0]!.id;
  f = fixtures(t, () => wardId);
  t.clock.set(START);
  province = await f.staff("province_officer");
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

const outboxCount = async (type: string, key: string, id: string) =>
  (await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = $1 AND payload->>$2 = $3", [type, key, id])).rowCount;

describe("L09 HD-01 Cán bộ Sở records a Hội đồng (stories 1, 4)", () => {
  it("creates a Hội đồng with its quyết định thành lập; it is listed and read back, with audit and outbox", async () => {
    const decisionFileId = await f.uploadPdf(province, "council_decision", "QĐ 12.pdf");
    const { councilId } = await t.app.councils.create(province, {
      name: "Hội đồng OCOP tỉnh 2026",
      decisionNumber: "12/QĐ-UBND",
      decisionDate: "2026-09-01",
      decisionFileId,
    });

    const council = await t.app.councils.get(province, { councilId });
    expect(council).toMatchObject({
      id: councilId,
      name: "Hội đồng OCOP tỉnh 2026",
      decisionNumber: "12/QĐ-UBND",
      decisionDate: "2026-09-01",
      decisionFile: { id: decisionFileId, fileName: "QĐ 12.pdf" },
      leader: null,
    });
    expect((await t.app.councils.list(province)).map((c) => c.id)).toContain(councilId);

    const [entry] = await t.app.audit.search(await f.admin(), { action: ["council.created"], targetId: councilId });
    expect(entry).toMatchObject({ targetType: "council", after: { name: "Hội đồng OCOP tỉnh 2026", decisionNumber: "12/QĐ-UBND" } });
    expect(await outboxCount("council.created", "councilId", councilId)).toBe(1);
  });
});

describe("L09 HD-01 Cán bộ Sở corrects a Hội đồng (story 4)", () => {
  it("changes the tên, số, ngày and tệp quyết định, auditing before and after", async () => {
    const councilId = await f.council(province, "Hội đồng sai tên");
    const before = await t.app.councils.get(province, { councilId });
    const newFile = await f.uploadPdf(province, "council_decision", "QĐ sửa đổi.pdf");
    await t.app.councils.update(province, { councilId, name: "Hội đồng đúng tên", decisionNumber: "99/QĐ-UBND", decisionDate: "2026-09-15", decisionFileId: newFile });

    expect(await t.app.councils.get(province, { councilId })).toMatchObject({
      name: "Hội đồng đúng tên",
      decisionNumber: "99/QĐ-UBND",
      decisionDate: "2026-09-15",
      decisionFile: { id: newFile, fileName: "QĐ sửa đổi.pdf" },
    });
    const [entry] = await t.app.audit.search(await f.admin(), { action: ["council.updated"], targetId: councilId });
    expect(entry).toMatchObject({ before: { name: "Hội đồng sai tên", decisionFileId: before.decisionFileId }, after: { name: "Hội đồng đúng tên", decisionFileId: newFile } });
    expect(await outboxCount("council.updated", "councilId", councilId)).toBe(1);
  });

  it("keeps the recorded quyết định when only the tên changes", async () => {
    const councilId = await f.council(province);
    const before = await t.app.councils.get(province, { councilId });
    await t.app.councils.update(province, { councilId, name: "Tên mới", decisionNumber: before.decisionNumber, decisionDate: before.decisionDate, decisionFileId: before.decisionFileId });
    expect((await t.app.councils.get(province, { councilId })).decisionFile?.id).toBe(before.decisionFileId);
  });

  it("refuses a blank tên or số, an invalid ngày, and a quyết định that is not the officer's council_decision upload", async () => {
    const fileId = await f.uploadPdf(province, "council_decision");
    const other = await f.staff("province_officer");
    const base = { name: "Hội đồng", decisionNumber: "1/QĐ", decisionDate: "2026-09-01", decisionFileId: fileId };
    await expect(t.app.councils.create(province, { ...base, name: "  " })).rejects.toMatchObject({ code: "name_required" });
    await expect(t.app.councils.create(province, { ...base, decisionNumber: "" })).rejects.toMatchObject({ code: "decision_number_required" });
    await expect(t.app.councils.create(province, { ...base, decisionDate: "2026-02-30" })).rejects.toMatchObject({ code: "invalid_date" });
    await expect(t.app.councils.create(other, base)).rejects.toMatchObject({ code: "decision_file_required" });
    const owner = await f.verifiedOwner();
    const evidence = await f.uploadPdf(owner, "evidence");
    await expect(t.app.councils.create(province, { ...base, decisionFileId: evidence })).rejects.toMatchObject({ code: "decision_file_required" });
    await expect(t.app.councils.create(province, { ...base, decisionFileId: "khong-phai-id" })).rejects.toMatchObject({ code: "decision_file_required" });
  });

  it("downloads the quyết định thành lập once it is clean", async () => {
    const councilId = await f.council(province);
    const { url, fileName } = await t.app.councils.downloadDecision(province, { councilId });
    expect(fileName).toBe("QĐ thành lập.pdf");
    expect((await fetch(url)).ok).toBe(true);
  });
});

describe("L09 HD-01 Phân vai on Phạm vi Hội đồng (stories 5 to 8)", () => {
  it("grants the four council Vai trò on an existing Hội đồng and lists them as its members by Vai trò", async () => {
    const { councilId, chair, secretary, members, advisors } = await f.staffedCouncil(province, { members: 2, advisors: 1 });
    const council = await t.app.councils.get(province, { councilId });
    expect(council.members.council_chair.map((m) => m.userId)).toEqual([chair.userId]);
    expect(council.members.council_secretary.map((m) => m.userId)).toEqual([secretary.userId]);
    expect(council.members.council_member.map((m) => m.userId)).toEqual(members.map((m) => m.userId));
    expect(council.members.advisory_member.map((m) => m.userId)).toEqual(advisors.map((m) => m.userId));
    expect(council.members.council_member[0]).toMatchObject({ fullName: members[0]!.fullName, email: members[0]!.email });
    expect(chair).toMatchObject({ activeRole: "council_chair", activeScope: { type: "council", id: councilId } });
  });

  it("refuses a Phạm vi Hội đồng that does not exist, or a council Vai trò without one", async () => {
    const admin = await f.admin();
    const someone = await f.staff("province_officer");
    await expect(
      t.app.identity.grantRole(admin, { userId: someone.userId, role: "council_member", scopeId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toMatchObject({ code: "scope_not_found" });
    await expect(t.app.identity.grantRole(admin, { userId: someone.userId, role: "council_member", scopeId: null })).rejects.toMatchObject({ code: "scope_required" });
  });

  it("shows the Phạm vi Hội đồng by its tên, in the account page and the Vai trò switcher (story 6)", async () => {
    const councilId = await f.council(province, "Hội đồng Phạm vi");
    const member = await f.staff("council_member", councilId);
    const user = await t.app.identity.getUser(await f.admin(), { userId: member.userId });
    expect(user.assignments.map((a) => a.scopeLabel)).toEqual(["Hội đồng Phạm vi"]);
    expect((await t.app.identity.myAssignments(member)).map((a) => a.scopeLabel)).toEqual(["Hội đồng Phạm vi"]);
  });

  it("drops a member from the list once their Phân vai is thu hồi (story 7)", async () => {
    const { councilId, members } = await f.staffedCouncil(province, { members: 2, advisors: 0 });
    const [gone, stays] = members;
    const before = await t.app.councils.get(province, { councilId });
    const assignmentId = before.members.council_member.find((m) => m.userId === gone!.userId)!.assignmentId;
    await t.app.identity.revokeRole(await f.admin(), { assignmentId });
    const after = await t.app.councils.get(province, { councilId });
    expect(after.members.council_member.map((m) => m.userId)).toEqual([stays!.userId]);
  });

  it("lets a Người dùng holding two Phân vai on one Hội đồng switch between them (story 9)", async () => {
    const councilId = await f.council(province);
    const both = await f.staff("council_member", councilId);
    await t.app.identity.grantRole(await f.admin(), { userId: both.userId, role: "advisory_member", scopeId: councilId });
    const mine = await t.app.identity.myAssignments(both);
    expect(mine.map((a) => a.role).sort()).toEqual(["advisory_member", "council_member"]);
    const advisory = mine.find((a) => a.role === "advisory_member")!;
    await t.app.identity.switchActiveRole(both, { assignmentId: advisory.id });
    const council = await t.app.councils.get(province, { councilId });
    expect(council.members.council_member.map((m) => m.userId)).toEqual([both.userId]);
    expect(council.members.advisory_member.map((m) => m.userId)).toEqual([both.userId]);
  });
});

describe("L09 HD-01 Tổ trưởng (stories 2, 3)", () => {
  it("names a Thành viên Tổ tư vấn of the Hội đồng as Tổ trưởng, then changes it, auditing each change", async () => {
    const { councilId, advisors } = await f.staffedCouncil(province, { members: 0, advisors: 2 });
    const [first, second] = advisors;
    await t.app.councils.setLeader(province, { councilId, userId: first!.userId });
    expect((await t.app.councils.get(province, { councilId })).leader).toEqual({ userId: first!.userId, fullName: first!.fullName, active: true });
    await t.app.councils.setLeader(province, { councilId, userId: second!.userId });
    expect((await t.app.councils.get(province, { councilId })).leader?.userId).toBe(second!.userId);

    const entries = await t.app.audit.search(await f.admin(), { action: ["council.leader_changed"], targetId: councilId });
    expect(entries.map((e) => e.after)).toEqual(expect.arrayContaining([{ leaderUserId: first!.userId }, { leaderUserId: second!.userId }]));
    const { rows } = await db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'council.leader_changed' AND payload->>'councilId' = $1", [councilId]);
    expect(rows.map((r) => r.payload.toUserId)).toEqual(expect.arrayContaining([first!.userId, second!.userId]));
  });

  it("refuses a Tổ trưởng who is not a Thành viên Tổ tư vấn in force on this Hội đồng", async () => {
    const { councilId, members, advisors } = await f.staffedCouncil(province, { members: 1, advisors: 1 });
    const elsewhere = await f.staffedCouncil(province, { members: 0, advisors: 1 });
    const refused = { code: "leader_not_advisory_member" };
    await expect(t.app.councils.setLeader(province, { councilId, userId: members[0]!.userId })).rejects.toMatchObject(refused);
    await expect(t.app.councils.setLeader(province, { councilId, userId: elsewhere.advisors[0]!.userId })).rejects.toMatchObject(refused);
    const assignmentId = (await t.app.councils.get(province, { councilId })).members.advisory_member[0]!.assignmentId;
    await t.app.identity.revokeRole(await f.admin(), { assignmentId });
    await expect(t.app.councils.setLeader(province, { councilId, userId: advisors[0]!.userId })).rejects.toMatchObject(refused);
  });

  it("shows a Tổ trưởng whose Phân vai Thành viên Tổ tư vấn ended as no longer active", async () => {
    const { councilId, advisors } = await f.staffedCouncil(province, { members: 0, advisors: 1 });
    await t.app.councils.setLeader(province, { councilId, userId: advisors[0]!.userId });
    const assignmentId = (await t.app.councils.get(province, { councilId })).members.advisory_member[0]!.assignmentId;
    await t.app.identity.revokeRole(await f.admin(), { assignmentId });
    expect((await t.app.councils.get(province, { councilId })).leader).toMatchObject({ userId: advisors[0]!.userId, active: false });
  });
});
