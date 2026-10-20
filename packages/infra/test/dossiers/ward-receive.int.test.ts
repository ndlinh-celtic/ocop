import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { createTestApp, createTestDatabase, systemActor, type TestApp, type TestDatabase } from "../support";
import { ADMIN, fixtures } from "./fixtures";

let db: TestDatabase;
let t: TestApp;
let wardX: string;
let wardY: string;
let f: ReturnType<typeof fixtures>;
let sets: Record<"Rau củ quả" | "Thịt tươi", string>;
let officerX: UserActor;
let officerX2: UserActor;
let officerY: UserActor;
const START = new Date("2026-10-19T02:00:00Z");

beforeAll(async () => {
  db = await createTestDatabase();
  t = createTestApp(db, { totpRequired: false });
  await t.app.identity.bootstrapFirstAdmin(systemActor("bootstrap"), ADMIN);
  await seedWards(db.app, "ma,ten\n00001,Xã An Phú\n00002,Xã Bình Lợi\n");
  const wards = await t.app.org.listWards();
  wardX = wards.find((w) => w.name === "Xã An Phú")!.id;
  wardY = wards.find((w) => w.name === "Xã Bình Lợi")!.id;
  f = fixtures(t, () => wardX);
  t.clock.set(START);
  const version = await f.publishedVersion("26/2026/QĐ-TTg");
  sets = version.sets;
  await f.openRound(version.versionId);
  officerX = await f.staff("ward_officer", wardX);
  officerX2 = await f.staff("ward_officer", wardX);
  officerY = await f.staff("ward_officer", wardY);
});
beforeEach(() => {
  t.clock.set(START);
});
afterAll(async () => {
  await t.stop();
  await db.drop();
});

describe("L05 XA-01 Cán bộ xã sees the hồ sơ of their xã (stories 39, 43, 77, 80)", () => {
  it("lists and reads a hồ sơ submitted to their xã; Cán bộ xã of another xã gets not found", async () => {
    const { dossierId } = await f.submitted(sets["Rau củ quả"]);

    expect((await t.app.dossiers.list(officerX)).map((d) => d.id)).toContain(dossierId);
    expect(await t.app.dossiers.get(officerX, { dossierId })).toMatchObject({ id: dossierId, state: "submitted_to_ward", wardId: wardX });
    expect((await t.app.dossiers.list(officerY)).map((d) => d.id)).not.toContain(dossierId);
    await expect(t.app.dossiers.get(officerY, { dossierId })).rejects.toMatchObject({ code: "not_found" });
    await expect(t.app.dossiers.timeline(officerY, { dossierId })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("L05 XA-01 Cán bộ xã sees the Chủ thể with a hồ sơ in their xã (stories 44, 77)", () => {
  it("keeps seeing a Chủ thể that moved to another xã while its hồ sơ stays here, with its hồ sơ pháp lý, but cannot act for it", async () => {
    const { a } = await f.submitted(sets["Rau củ quả"]);
    const entityId = a.activeScope!.id!;
    const before = await t.app.entities.getEntity(a, { entityId });
    await t.app.entities.updateEntity(a, { entityId, name: before.name, address: before.address, representativeName: before.representativeName, phone: before.phone, wardId: wardY });

    expect((await t.app.entities.listEntities(officerX)).map((e) => e.id)).toContain(entityId);
    expect(await t.app.entities.getEntity(officerX, { entityId })).toMatchObject({ id: entityId, ward: { id: wardY } });
    expect((await t.app.entities.getLegalStanding(officerX, { entityId })).documents).toHaveLength(1);
    expect((await t.app.entities.listEntities(officerY)).map((e) => e.id)).toContain(entityId);
    // Acting for the Chủ thể stays with the xã it is registered in.
    await expect(t.app.entities.changeRepresentativeEmail(officerX, { entityId, email: "moi@example.vn" })).rejects.toMatchObject({ code: "not_found" });
  });

  it("does not see a Chủ thể of another xã whose only hồ sơ is a Nháp", async () => {
    const a = await f.verifiedOwner(wardY);
    await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    await expect(t.app.entities.getEntity(officerX, { entityId: a.activeScope!.id! })).rejects.toMatchObject({ code: "not_found" });
    expect((await t.app.entities.listEntities(officerX)).map((e) => e.id)).not.toContain(a.activeScope!.id!);
  });
});

describe("L05 XA-01 chi tiết hồ sơ theo Phiên bản nộp mới nhất (stories 44 to 46)", () => {
  it("lists the Tiêu chí without minh chứng of the newest Phiên bản nộp, and only those", async () => {
    const { dossierId } = await f.submitted(sets["Rau củ quả"]);
    const bare = await t.app.dossiers.get(officerX, { dossierId });
    expect(bare.latestSubmission).toMatchObject({ number: 1 });
    expect(bare.criteriaWithoutEvidence).toEqual([{ criterionId: expect.any(String), code: "1.1", name: "Tiêu chí thử" }]);

    const a = await f.verifiedOwner();
    const created = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    let version = await f.completeDraft(a, created.dossierId);
    const fileId = await f.uploadPdf(a, "evidence", "Minh chứng.pdf");
    ({ version } = await t.app.dossiers.addEvidenceFile(a, { dossierId: created.dossierId, expectedVersion: version, fileId }));
    ({ version } = await t.app.dossiers.linkEvidence(a, { dossierId: created.dossierId, expectedVersion: version, fileId, criterionIds: [bare.criteriaWithoutEvidence[0]!.criterionId] }));
    await t.app.dossiers.submit(a, { dossierId: created.dossierId, expectedVersion: version });

    expect((await t.app.dossiers.get(officerX, { dossierId: created.dossierId })).criteriaWithoutEvidence).toEqual([]);
  });

  it("flags thông tin Chủ thể that differs now from the Phiên bản nộp, without changing the state", async () => {
    const { a, dossierId } = await f.submitted(sets["Rau củ quả"]);
    const entityId = a.activeScope!.id!;
    const before = await t.app.entities.getEntity(a, { entityId });
    await t.app.entities.updateEntity(a, { entityId, name: "Tên mới", address: before.address, representativeName: before.representativeName, phone: "0912345678", wardId: wardX });

    const view = await t.app.dossiers.get(officerX, { dossierId });

    expect(view.state).toBe("submitted_to_ward");
    expect(view.flags).toContainEqual({ kind: "entity_changed", fields: ["name", "phone"] });
  });
});

describe("L05 XA-01 danh sách hồ sơ của xã (stories 39, 43)", () => {
  it("filters Chờ tiếp nhận, của tôi and by state, showing the Chủ thể and the date of nộp", async () => {
    const waiting = await f.submitted(sets["Rau củ quả"]);
    t.clock.set(new Date("2026-10-21T01:00:00Z"));
    const mine = await f.submitted(sets["Thịt tươi"]);
    await t.app.dossiers.receive(officerX2, { dossierId: mine.dossierId, expectedVersion: mine.version });
    const withdrawn = await f.submitted(sets["Rau củ quả"]);
    await t.app.dossiers.withdraw(withdrawn.a, { dossierId: withdrawn.dossierId, expectedVersion: withdrawn.version, reason: "Nộp nhầm" });

    const pending = await t.app.dossiers.list(officerX, { filter: "awaiting_receipt" });
    expect(pending.map((d) => d.id)).toContain(waiting.dossierId);
    expect(pending.map((d) => d.id)).not.toContain(mine.dossierId);
    expect(pending.find((d) => d.id === waiting.dossierId)).toMatchObject({
      submittedAt: START,
      entity: { id: waiting.a.activeScope!.id, name: expect.stringMatching(/^Chủ thể \d+$/) },
      handler: null,
    });

    const ofX2 = await t.app.dossiers.list(officerX2, { filter: "mine" });
    expect(ofX2.map((d) => d.id)).toContain(mine.dossierId);
    expect(ofX2.every((d) => d.handlerUserId === officerX2.userId)).toBe(true);
    expect(ofX2.find((d) => d.id === mine.dossierId)).toMatchObject({ submittedAt: new Date("2026-10-21T01:00:00Z"), handler: { userId: officerX2.userId, fullName: expect.any(String) } });
    expect((await t.app.dossiers.list(officerX, { filter: "mine" })).map((d) => d.id)).not.toContain(mine.dossierId);

    const ofState = await t.app.dossiers.list(officerX, { state: "withdrawn" });
    expect(ofState.map((d) => d.id)).toContain(withdrawn.dossierId);
    expect(ofState.every((d) => d.state === "withdrawn")).toBe(true);
  });
});

describe("L05 XA-02 Tiếp nhận hồ sơ (stories 40, 84, 85)", () => {
  it("records when and by whom, with the receiving Cán bộ xã as Cán bộ phụ trách by default, without changing the state", async () => {
    const { dossierId, version } = await f.submitted(sets["Rau củ quả"]);
    t.clock.set(new Date("2026-10-20T03:00:00Z"));

    const after = await t.app.dossiers.receive(officerX, { dossierId, expectedVersion: version });

    expect(after.version).toBe(version + 1);
    expect(await t.app.dossiers.get(officerX, { dossierId })).toMatchObject({
      state: "submitted_to_ward",
      version: after.version,
      receivedAt: new Date("2026-10-20T03:00:00Z"),
      receivedBy: officerX.userId,
      handlerUserId: officerX.userId,
    });
    expect((await t.app.dossiers.timeline(officerX, { dossierId })).at(-1)).toMatchObject({
      action: "dossier.receive",
      fromState: "submitted_to_ward",
      toState: "submitted_to_ward",
      actorUserId: officerX.userId,
      actorRole: "ward_officer",
      metadata: { handlerUserId: officerX.userId },
    });
    const [audit] = await t.app.audit.search(await f.admin(), { action: ["dossier.receive"], targetId: dossierId });
    expect(audit).toMatchObject({ actorUserId: officerX.userId, actorRole: "ward_officer", metadata: { handlerUserId: officerX.userId } });
    const { rows } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.received' AND payload->>'dossierId' = $1", [dossierId]);
    expect(rows).toHaveLength(1);
  });

  it("names another Cán bộ xã of the xã as Cán bộ phụ trách, but no one from outside the xã", async () => {
    const { dossierId, version } = await f.submitted(sets["Rau củ quả"]);
    await expect(t.app.dossiers.receive(officerX, { dossierId, expectedVersion: version, handlerUserId: officerY.userId })).rejects.toMatchObject({
      code: "invalid_handler",
    });

    await t.app.dossiers.receive(officerX, { dossierId, expectedVersion: version, handlerUserId: officerX2.userId });

    expect(await t.app.dossiers.get(officerX, { dossierId })).toMatchObject({ receivedBy: officerX.userId, handlerUserId: officerX2.userId });
    expect((await t.app.dossiers.handlers(officerX)).map((h) => h.userId).sort()).toEqual([officerX.userId, officerX2.userId].sort());
  });

  it("refuses a second Tiếp nhận, one from a stale version, and one by a Chủ thể or another xã (stories 80, 81, 87)", async () => {
    const { a, dossierId, version } = await f.submitted(sets["Rau củ quả"]);
    await expect(t.app.dossiers.receive(a, { dossierId, expectedVersion: version })).rejects.toMatchObject({ code: "forbidden" });
    await expect(t.app.dossiers.receive(officerY, { dossierId, expectedVersion: version })).rejects.toMatchObject({ code: "not_found" });

    const { version: received } = await t.app.dossiers.receive(officerX, { dossierId, expectedVersion: version });

    // The second Cán bộ xã still holds the version from before the first one's Tiếp nhận: "hồ sơ đã thay đổi".
    await expect(t.app.dossiers.receive(officerX2, { dossierId, expectedVersion: version })).rejects.toMatchObject({ code: "version_conflict" });
    await expect(t.app.dossiers.changeHandler(officerX2, { dossierId, expectedVersion: version, handlerUserId: officerX2.userId })).rejects.toMatchObject({
      code: "version_conflict",
    });
    // Once reloaded, Tiếp nhận is no longer offered.
    await expect(t.app.dossiers.receive(officerX2, { dossierId, expectedVersion: received })).rejects.toMatchObject({ code: "already_received" });
    expect(await t.app.dossiers.get(officerX, { dossierId })).toMatchObject({ version: received, handlerUserId: officerX.userId });
  });

  it("refuses a Nháp, which belongs to no xã yet, as not found", async () => {
    const a = await f.verifiedOwner();
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId: sets["Rau củ quả"] });
    await expect(t.app.dossiers.receive(officerX, { dossierId, expectedVersion: 1 })).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("L05 thông báo (story 86)", () => {
  const latestFor = async (actor: UserActor, dossierId: string) => (await t.app.notifications.list(actor)).find((n) => n.link?.endsWith(dossierId));

  it("tells every Cán bộ xã of the xã, in the app and by email, that a hồ sơ was submitted; another xã hears nothing", async () => {
    const { dossierId } = await f.submitted(sets["Rau củ quả"]);
    await t.drainJobs();

    for (const officer of [officerX, officerX2]) {
      expect(await latestFor(officer, dossierId)).toMatchObject({ kind: "dossier_submitted", title: expect.stringContaining("Bưởi da xanh An Phú"), link: `/xa/ho-so/${dossierId}` });
      expect(t.mailbox.to(officer.email).at(-1)).toMatchObject({ subject: expect.stringContaining("Hồ sơ mới nộp") });
      expect(t.mailbox.to(officer.email).at(-1)!.text).toContain(`/xa/ho-so/${dossierId}`);
    }
    expect(await latestFor(officerY, dossierId)).toBeUndefined();
  });

  it("tells the Chủ thể, in the app and by email, that its hồ sơ was Tiếp nhận", async () => {
    const { a, dossierId, version } = await f.submitted(sets["Rau củ quả"]);
    await t.app.dossiers.receive(officerX, { dossierId, expectedVersion: version });
    await t.drainJobs();

    expect(await latestFor(a, dossierId)).toMatchObject({ kind: "dossier_received", link: `/chu-the/ho-so/${dossierId}` });
    expect(t.mailbox.to(a.email).at(-1)).toMatchObject({ subject: expect.stringContaining("đã được tiếp nhận") });
  });
});

describe("L05 XA-03 Cán bộ phụ trách (stories 41, 43)", () => {
  it("any Cán bộ xã of the xã, not only the Cán bộ phụ trách, changes it; each change stays on the timeline", async () => {
    const { a, dossierId, version } = await f.submitted(sets["Rau củ quả"]);
    const received = await t.app.dossiers.receive(officerX, { dossierId, expectedVersion: version });

    const changed = await t.app.dossiers.changeHandler(officerX2, { dossierId, expectedVersion: received.version, handlerUserId: officerX2.userId });
    await t.app.dossiers.changeHandler(officerX2, { dossierId, expectedVersion: changed.version, handlerUserId: officerX.userId });

    expect(await t.app.dossiers.get(officerX, { dossierId })).toMatchObject({ handlerUserId: officerX.userId, receivedBy: officerX.userId });
    const changes = (await t.app.dossiers.timeline(a, { dossierId })).filter((e) => e.action === "dossier.handler.change");
    expect(changes).toMatchObject([
      { actorUserId: officerX2.userId, fromState: "submitted_to_ward", toState: "submitted_to_ward", metadata: { fromHandlerUserId: officerX.userId, handlerUserId: officerX2.userId } },
      { actorUserId: officerX2.userId, metadata: { fromHandlerUserId: officerX2.userId, handlerUserId: officerX.userId } },
    ]);
    const audit = await t.app.audit.search(await f.admin(), { action: ["dossier.handler.change"], targetId: dossierId });
    expect(audit).toHaveLength(2);
    const { rows } = await db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.handler_changed' AND payload->>'dossierId' = $1", [dossierId]);
    expect(rows).toHaveLength(2);
  });

  it("refuses before Tiếp nhận, to the same Cán bộ, to someone outside the xã, and from another xã", async () => {
    const { dossierId, version } = await f.submitted(sets["Rau củ quả"]);
    await expect(t.app.dossiers.changeHandler(officerX, { dossierId, expectedVersion: version, handlerUserId: officerX2.userId })).rejects.toMatchObject({
      code: "not_received",
    });
    const { version: received } = await t.app.dossiers.receive(officerX, { dossierId, expectedVersion: version });
    const change = (actor: UserActor, handlerUserId: string) => t.app.dossiers.changeHandler(actor, { dossierId, expectedVersion: received, handlerUserId });

    await expect(change(officerX, officerX.userId)).rejects.toMatchObject({ code: "handler_unchanged" });
    await expect(change(officerX, officerY.userId)).rejects.toMatchObject({ code: "invalid_handler" });
    await expect(change(officerX, "not-a-uuid")).rejects.toMatchObject({ code: "invalid_handler" });
    await expect(change(officerY, officerY.userId)).rejects.toMatchObject({ code: "not_found" });
  });
});
