import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "../dossiers/fixtures";

/*
 * L09 HD-02, HD-03 Phân công (#52, spec #49 stories 24 to 29, 41, 79): the Thư ký hội đồng sees the hồ sơ
 * Tiếp nhận tại tỉnh of the đợt gán to its Hội đồng and writes their Phân công nháp. Giao chấm (#53) gives
 * them effect; until then the Phân công shows the hồ sơ to nobody.
 */

let db: TestDatabase;
let t: TestApp;
let wardId: string;
let f: ReturnType<typeof fixtures>;
let setId: string;
let ward: UserActor;
let province: UserActor;
let A: Awaited<ReturnType<ReturnType<typeof fixtures>["staffedCouncil"]>>;
let B: Awaited<ReturnType<ReturnType<typeof fixtures>["staffedCouncil"]>>;
const START = new Date("2026-10-19T02:00:00Z");
const RETURN = { deadline: "2026-10-31", items: [{ content: "Bổ sung phiếu kiểm nghiệm" }] };

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n");
  wardId = (await t.app.org.listWards())[0]!.id;
  f = fixtures(t, () => wardId);
  t.clock.set(START);
  const version = await f.publishedVersion("26/2026/QĐ-TTg");
  setId = version.sets["Rau củ quả"];
  const roundId = await f.openRound(version.versionId);
  ward = await f.staff("ward_officer", wardId);
  province = await f.staff("province_officer");
  A = await f.staffedCouncil(province, { members: 3, advisors: 2 });
  B = await f.staffedCouncil(province, { members: 1, advisors: 1 });
  await t.app.rounds.assignCouncil(province, { roundId, councilId: A.councilId });
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

const received = () => f.provinceReceived(ward, province, setId);
const edit = (actor: UserActor, dossiers: { dossierId: string; version: number }[], members: UserActor[], advisors: UserActor[] = []) =>
  t.app.councils.editAssignments(actor, {
    dossiers: dossiers.map((d) => ({ dossierId: d.dossierId, expectedVersion: d.version })),
    members: members.map((m) => m.userId),
    advisors: advisors.map((a) => a.userId),
  });
const assigned = async (dossierId: string) =>
  (await t.app.councils.assignments(A.secretary, { dossierId })).map((a) => [a.userId, a.kind, a.effectiveAt]).sort();
const outboxCount = async (type: string, id: string) =>
  (await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = $1 AND payload->>'dossierId' = $2", [type, id])).rowCount;
const listed = async (actor: UserActor) => (await t.app.dossiers.list(actor)).map((d) => d.id);
/** Stand-in for Giao chấm (#53), which is the only writer of effective_at. */
const takeEffect = (dossierId: string) => db.admin.query("UPDATE council.assignment SET effective_at = $2 WHERE dossier_id = $1", [dossierId, START]);

describe("L09 HD-02 the Thư ký sees the hồ sơ of its Hội đồng (story 24)", () => {
  it("lists a hồ sơ from its Tiếp nhận tại tỉnh on, with its mã and đợt, for the Chủ tịch and Thư ký of the Hội đồng only", async () => {
    const up = await f.forwarded(ward, setId);
    expect(await listed(A.secretary)).not.toContain(up.dossierId);
    await t.app.dossiers.receiveAtProvince(province, { dossierId: up.dossierId, expectedVersion: up.version });

    for (const actor of [A.secretary, A.chair]) expect(await listed(actor)).toContain(up.dossierId);
    for (const actor of [B.secretary, B.chair]) expect(await listed(actor)).not.toContain(up.dossierId);
    const seen = await t.app.dossiers.get(A.secretary, { dossierId: up.dossierId });
    expect(seen).toMatchObject({ code: expect.stringMatching(/^HS-2026-/), state: "forwarded_to_province", councilId: A.councilId });
  });
});

describe("L09 HD-02 Phân công nháp (stories 25 to 29, 41)", () => {
  it("assigns several hồ sơ at once to the same people, with audit and outbox per hồ sơ, off the Chủ thể's timeline", async () => {
    const one = await received();
    const two = await received();

    const result = await edit(A.secretary, [one, two], [A.members[0]!, A.members[1]!], [A.advisors[0]!]);

    expect(result.dossiers).toEqual([
      { dossierId: one.dossierId, version: one.version + 1 },
      { dossierId: two.dossierId, version: two.version + 1 },
    ]);
    const expected = [
      [A.members[0]!.userId, "member", null],
      [A.members[1]!.userId, "member", null],
      [A.advisors[0]!.userId, "advisory", null],
    ].sort();
    expect(await assigned(one.dossierId)).toEqual(expected);
    expect(await assigned(two.dossierId)).toEqual(expected);
    expect((await t.app.councils.assignments(A.chair, { dossierId: one.dossierId })).map((a) => a.fullName)).toContain(A.members[0]!.fullName);
    for (const d of [one, two]) {
      const [entry] = await t.app.audit.search(await f.admin(), { action: ["dossier.assignment.edit"], targetId: d.dossierId });
      expect(entry).toMatchObject({ actorUserId: A.secretary.userId, actorRole: "council_secretary", metadata: { advisors: [A.advisors[0]!.userId] } });
      expect(await outboxCount("dossier.assignment_changed", d.dossierId)).toBe(1);
      expect((await t.app.dossiers.timeline(d.a, { dossierId: d.dossierId })).map((e) => e.action)).not.toContain("dossier.assignment.edit");
    }
  });

  it("is changed freely before Giao chấm: the new lists replace the nháp (story 29)", async () => {
    const d = await received();
    const { version } = (await edit(A.secretary, [d], [A.members[0]!], [A.advisors[0]!])).dossiers[0]!;

    await edit(A.secretary, [{ dossierId: d.dossierId, version }], [A.members[1]!], [A.advisors[1]!]);

    expect(await assigned(d.dossierId)).toEqual(
      [
        [A.members[1]!.userId, "member", null],
        [A.advisors[1]!.userId, "advisory", null],
      ].sort(),
    );
  });

  it("refuses one person as both Thành viên Tổ tư vấn and thành viên chấm of a hồ sơ (story 28)", async () => {
    const d = await received();
    await f.grant(A.members[2]!, "advisory_member", A.councilId);

    await expect(edit(A.secretary, [d], [A.members[2]!], [A.members[2]!])).rejects.toMatchObject({ code: "conflict_of_roles" });
    expect(await assigned(d.dossierId)).toEqual([]);
    // Moving a person from one list to the other is a change of nháp, not a conflict.
    const { version } = (await edit(A.secretary, [d], [A.members[2]!])).dossiers[0]!;
    await edit(A.secretary, [{ dossierId: d.dossierId, version }], [], [A.members[2]!]);
    expect(await assigned(d.dossierId)).toEqual([[A.members[2]!.userId, "advisory", null]]);
  });

  it("only takes Người dùng with a Phân vai of the right Vai trò in force on the Hội đồng of the đợt (stories 25, 26)", async () => {
    const d = await received();
    const candidates = await t.app.councils.assignmentCandidates(A.secretary);
    expect(candidates.members.map((m) => m.userId)).toEqual(expect.arrayContaining(A.members.map((m) => m.userId)));
    expect(candidates.advisors.map((m) => m.userId)).toEqual(expect.arrayContaining(A.advisors.map((m) => m.userId)));
    expect(candidates.members.map((m) => m.userId)).not.toContain(B.members[0]!.userId);

    await expect(edit(A.secretary, [d], [B.members[0]!])).rejects.toMatchObject({ code: "not_council_member" });
    await expect(edit(A.secretary, [d], [A.advisors[0]!])).rejects.toMatchObject({ code: "not_council_member" });
    await expect(edit(A.secretary, [d], [], [A.members[0]!])).rejects.toMatchObject({ code: "not_advisory_member" });
    await expect(edit(A.secretary, [d], [A.chair])).rejects.toMatchObject({ code: "not_council_member" });

    const leaving = await f.staff("council_member", A.councilId);
    await t.app.identity.revokeRole(await f.admin(), { assignmentId: leaving.activeAssignmentId! });
    await expect(edit(A.secretary, [d], [leaving])).rejects.toMatchObject({ code: "not_council_member" });
    expect(await assigned(d.dossierId)).toEqual([]);
  });

  it("changes every hồ sơ of a batch or none: a stale version on one rolls the others back", async () => {
    const one = await received();
    const two = await received();

    await expect(edit(A.secretary, [one, { ...two, version: two.version - 1 }], [A.members[0]!])).rejects.toMatchObject({ code: "version_conflict" });

    expect(await assigned(one.dossierId)).toEqual([]);
    expect((await t.app.dossiers.get(A.secretary, { dossierId: one.dossierId })).version).toBe(one.version);
    await expect(t.app.councils.editAssignments(A.secretary, { dossiers: [], members: [], advisors: [] })).rejects.toMatchObject({ code: "dossiers_required" });
  });

  it("needs a Tiếp nhận tại tỉnh in the current lượt: after a Sở trả về and gửi tỉnh again, the Phân công nháp waits for it", async () => {
    const d = await received();
    let { version } = (await edit(A.secretary, [d], [A.members[0]!])).dossiers[0]!;
    ({ version } = await t.app.dossiers.returnFromProvince(province, { dossierId: d.dossierId, expectedVersion: version, ...RETURN }));
    await expect(edit(A.secretary, [{ dossierId: d.dossierId, version }], [A.members[1]!])).rejects.toMatchObject({ code: "invalid_state" });
    ({ version } = await t.app.dossiers.submit(d.a, { dossierId: d.dossierId, expectedVersion: version }));
    const fileId = await f.uploadPdf(ward, "signed_ward_report", "BC lần 2.pdf");
    ({ version } = await t.app.dossiers.attachSignedWardReport(ward, { dossierId: d.dossierId, expectedVersion: version, fileId }));
    ({ version } = await t.app.dossiers.forwardToProvince(ward, { dossierId: d.dossierId, expectedVersion: version }));

    await expect(edit(A.secretary, [{ dossierId: d.dossierId, version }], [A.members[1]!])).rejects.toMatchObject({ code: "not_province_received" });
    expect(await assigned(d.dossierId)).toEqual([[A.members[0]!.userId, "member", null]]);
    ({ version } = await t.app.dossiers.receiveAtProvince(province, { dossierId: d.dossierId, expectedVersion: version }));
    await expect(edit(A.secretary, [{ dossierId: d.dossierId, version }], [A.members[1]!])).resolves.toBeDefined();
  });
});

describe("L09 the DataScope `assigned`: a Phân công in force shows the hồ sơ, a nháp does not (stories 41, 79)", () => {
  it("shows the hồ sơ to its thành viên chấm and Thành viên Tổ tư vấn, each by the Vai trò of their kind, once in force", async () => {
    const d = await received();
    const { version } = (await edit(A.secretary, [d], [A.members[0]!], [A.advisors[0]!])).dossiers[0]!;
    for (const actor of [A.members[0]!, A.advisors[0]!]) {
      expect(await listed(actor)).not.toContain(d.dossierId);
      await expect(t.app.dossiers.get(actor, { dossierId: d.dossierId })).rejects.toMatchObject({ code: "not_found" });
    }

    await takeEffect(d.dossierId);

    for (const actor of [A.members[0]!, A.advisors[0]!]) {
      expect(await listed(actor)).toContain(d.dossierId);
      await expect(t.app.dossiers.get(actor, { dossierId: d.dossierId })).resolves.toMatchObject({ readerAssignment: actor === A.advisors[0] ? "advisory" : "member" });
    }
    for (const actor of [A.members[1]!, A.advisors[1]!, B.members[0]!]) {
      expect(await listed(actor)).not.toContain(d.dossierId);
      await expect(t.app.dossiers.get(actor, { dossierId: d.dossierId })).rejects.toMatchObject({ code: "not_found" });
    }
    // A Phân công in force is not dropped or changed by editing the nháp.
    await expect(edit(A.secretary, [{ dossierId: d.dossierId, version }], [A.members[1]!], [A.advisors[0]!])).rejects.toMatchObject({
      code: "assignment_in_force",
    });
    await expect(edit(A.secretary, [{ dossierId: d.dossierId, version }], [A.members[0]!, A.members[1]!], [A.advisors[0]!])).resolves.toBeDefined();
  });

  it("hides the hồ sơ again once the Phân công is replaced", async () => {
    const d = await received();
    await edit(A.secretary, [d], [A.members[0]!]);
    await takeEffect(d.dossierId);
    expect(await listed(A.members[0]!)).toContain(d.dossierId);

    await db.admin.query("UPDATE council.assignment SET replaced_at = $2, replaced_by = $3 WHERE dossier_id = $1", [d.dossierId, START, A.secretary.userId]);

    expect(await listed(A.members[0]!)).not.toContain(d.dossierId);
  });
});

describe("L09 Phân công in the database (CLAUDE.md: một người không vừa là Tổ tư vấn vừa chấm cùng hồ sơ)", () => {
  it("keeps one current row per (hồ sơ, Người dùng) whatever the kind, fixes what took effect, and never deletes it", async () => {
    const d = await received();
    await edit(A.secretary, [d], [A.members[0]!]);
    const insert = (id: string) =>
      db.app.query(
        "INSERT INTO council.assignment (id, dossier_id, user_id, kind, created_by, created_at) VALUES ($1, $2, $3, 'advisory', $4, now())",
        [id, d.dossierId, A.members[0]!.userId, A.secretary.userId],
      );
    await expect(insert("00000000-0000-4000-8000-000000000001")).rejects.toThrow(/assignment_current_key/);

    await takeEffect(d.dossierId);
    await expect(db.app.query("UPDATE council.assignment SET effective_at = now() WHERE dossier_id = $1", [d.dossierId])).rejects.toThrow(/fixed/);
    await expect(db.app.query("UPDATE council.assignment SET kind = 'advisory' WHERE dossier_id = $1", [d.dossierId])).rejects.toThrow(/fixed/);
    await expect(db.app.query("DELETE FROM council.assignment WHERE dossier_id = $1", [d.dossierId])).rejects.toThrow(/fixed/);
    await expect(db.admin.query("DELETE FROM council.assignment WHERE dossier_id = $1", [d.dossierId])).rejects.toThrow(/fixed/);
    await db.app.query("UPDATE council.assignment SET replaced_at = now(), replaced_by = $2 WHERE dossier_id = $1", [d.dossierId, A.secretary.userId]);
    await expect(db.app.query("UPDATE council.assignment SET replace_reason = 'x' WHERE dossier_id = $1", [d.dossierId])).rejects.toThrow(/fixed/);
    // Replaced, the person may be Phân công again.
    await expect(insert("00000000-0000-4000-8000-000000000002")).resolves.toBeDefined();
    await expect(db.app.query("ALTER TABLE council.assignment DISABLE TRIGGER assignment_guard")).rejects.toThrow(/must be owner/);
  });
});
