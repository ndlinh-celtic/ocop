import { beforeAll, describe, expect, it } from "vitest";
import type { DossierScores, UserActor } from "@ocop/core";
import { ADMIN } from "../dossiers/fixtures";
import { EICAR } from "../support";
import { scoringWorld } from "./world";

/*
 * L15 Mở khóa sau chốt (#63, spec #49 stories 127 to 133, ADR 0008): on the Hội đồng's văn bản yêu cầu, Quản trị
 * Mở khóa a hồ sơ Đã chốt điểm from a page of its own, after Xác thực lại. The hồ sơ goes back to Sẵn sàng chốt
 * (Thành viên xác nhận), the kết quả chốt stays as it was and is marked superseded, no phiếu changes. The Chủ tịch
 * and Thư ký hear of it, Trả phiếu whoever must grade again (the Vắng too), and chốt again in a new Phiên họp: n = 2.
 */
describe("L15 Mở khóa sau chốt (#63)", () => {
  const w = scoringWorld({ minGraders: 2 });
  const m = (i: number) => w.A.members[i]!;
  let admin: UserActor;
  beforeAll(async () => {
    admin = await w.f.admin();
  });

  const own = async (actor: UserActor, dossierId: string) => {
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId, ownSheet: true });
    if (view.kind !== "own_sheet") throw new Error(`expected own_sheet, got ${view.kind}`);
    return view;
  };
  async function scoreAndConfirm(actor: UserActor, dossierId: string, [a, b, c]: [number, number, number]) {
    const lines = (
      [
        ["1.1", a],
        ["2.1", b],
        ["3.1", c],
      ] as const
    ).map(([code, points]) => ({ criterionId: w.criterionId(code), levelId: w.level(`${code}:${points}`), comment: "", evidenceFileIds: [] }));
    const { version } = await w.t.app.scoring.saveScoreSheet(actor, { dossierId, expectedVersion: (await own(actor, dossierId)).sheet!.version, lines });
    await w.t.app.scoring.confirmScoreSheet(actor, { dossierId, expectedVersion: version });
  }
  const full = async (actor: UserActor, dossierId: string) => {
    const view: DossierScores = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "full") throw new Error(`expected full, got ${view.kind}`);
    return view;
  };
  const meetingWith = (actor: UserActor, title: string, dossierIds: string[]) =>
    w.t.app.scoring.createMeeting(actor, { roundId: w.roundId, title, heldOn: "2026-10-25", location: "Phòng họp Sở", dossierIds });
  const finalize = async (actor: UserActor, dossierId: string) =>
    w.t.app.scoring.finalize(actor, { dossierId, expectedVersion: (await full(actor, dossierId)).dossierVersion });

  /** A hồ sơ chốt in a Phiên họp: thành viên 0 and 1 confirmed, 2 Vắng. */
  async function finalized() {
    const d = await w.graded([m(0), m(1), m(2)]);
    await scoreAndConfirm(m(0), d.dossierId, [40, 25, 35]);
    await scoreAndConfirm(m(1), d.dossierId, [20, 25, 0]);
    await meetingWith(w.A.secretary, "Phiên họp thứ nhất", [d.dossierId]);
    await finalize(w.A.secretary, d.dossierId);
    const { code } = await w.t.app.dossiers.get(w.A.secretary, { dossierId: d.dossierId });
    return { ...d, code };
  }
  const requestFile = () => w.f.uploadPdf(admin, "unlock_request", "Công văn đề nghị mở khóa.pdf");
  const unlock = async (dossierId: string, over: Partial<{ requestFileId: string; requestedBy: string; reason: string }> = {}) =>
    w.t.app.scoring.unlockFinalized(admin, { dossierId, requestFileId: over.requestFileId ?? (await requestFile()), requestedBy: over.requestedBy ?? "Chủ tịch Hội đồng A", reason: over.reason ?? "Sai sót khi chấm tiêu chí 3.1" });

  it("finds the hồ sơ by mã with its state only, brings it back to Sẵn sàng chốt and supersedes kết quả 1 without touching a phiếu (stories 127 to 129)", async () => {
    const d = await finalized();
    const before = await full(w.A.secretary, d.dossierId);

    const target = await w.t.app.scoring.unlockTarget(admin, { code: ` ${d.code.toLowerCase()} ` });
    expect(target).toEqual({ dossierId: d.dossierId, code: d.code, state: "score_finalized", unlocks: [] });

    const result = await unlock(d.dossierId);

    expect(result).toMatchObject({ dossierState: "member_confirmed", supersededN: 1 });
    const after = await full(w.A.secretary, d.dossierId);
    expect(after.dossierState).toBe("member_confirmed");
    expect(after.result).toBeNull();
    expect(after.graders.map((g) => [g.userId, g.sheetId, g.state, g.total])).toEqual(before.graders.map((g) => [g.userId, g.sheetId, g.state, g.total]));
    const [first] = await w.t.app.scoring.finalizedResults(w.A.chair, { dossierId: d.dossierId });
    expect(first).toMatchObject({
      n: 1,
      total: before.result!.snapshot.aggregate.total,
      sha256: before.result!.sha256,
      supersededAt: w.t.clock.now(),
      unlock: { requestedBy: "Chủ tịch Hội đồng A", reason: "Sai sót khi chấm tiêu chí 3.1", unlockedBy: { userId: admin.userId } },
    });
    expect((await w.t.app.scoring.unlockTarget(admin, { code: d.code })).unlocks).toEqual([
      expect.objectContaining({ n: 1, requestedBy: "Chủ tịch Hội đồng A", reason: "Sai sót khi chấm tiêu chí 3.1", reauthMethod: "password" }),
    ]);
  });

  it("lets the Thư ký thay the Vắng thành viên after the Mở khóa, since they never xác nhận a phiếu (spec #49 HD-03)", async () => {
    const d = await finalized();
    await unlock(d.dossierId);
    const absent = (await own(m(2), d.dossierId)).sheet!;
    expect(absent.state).toBe("absent");
    const { version } = await w.t.app.dossiers.get(w.A.secretary, { dossierId: d.dossierId });

    await w.t.app.councils.replaceAssignment(w.A.secretary, { dossierId: d.dossierId, expectedVersion: version, userId: m(2).userId, newUserId: m(3).userId, reason: "Thành viên vắng dài ngày" });

    expect((await own(m(3), d.dossierId)).sheet).toMatchObject({ state: "draft", attempt: 1 });
    const old = await w.db.admin.query("SELECT state, superseded_reason FROM scoring.score_sheet WHERE id = $1", [absent.id]);
    expect(old.rows).toEqual([{ state: "superseded", superseded_reason: "Thành viên vắng dài ngày" }]);
    await scoreAndConfirm(m(3), d.dossierId, [40, 25, 35]);
    expect((await full(w.A.secretary, d.dossierId)).graders.map((g) => [g.userId, g.state])).toEqual([
      [m(0).userId, "confirmed"],
      [m(1).userId, "confirmed"],
      [m(3).userId, "confirmed"],
    ]);
  });

  it("then Trả phiếu the Vắng thành viên, who grades for the first time, and a chốt in a new Phiên họp writes kết quả 2 while kết quả 1 stays (stories 130, ADR 0008)", async () => {
    const d = await finalized();
    const first = (await full(w.A.secretary, d.dossierId)).result!;
    await unlock(d.dossierId);

    const absent = (await own(m(2), d.dossierId)).sheet!;
    expect(absent.state).toBe("absent");
    const returned = await w.t.app.scoring.returnScoreSheet(w.A.chair, { dossierId: d.dossierId, sheetId: absent.id, reason: "Chấm bổ sung theo văn bản của Hội đồng" });
    expect(returned.dossierState).toBe("member_confirmed");
    expect((await own(m(2), d.dossierId)).sheet).toMatchObject({ id: returned.scoreSheetId, state: "draft", attempt: 2 });
    await scoreAndConfirm(m(2), d.dossierId, [40, 25, 35]);

    await expect(finalize(w.A.secretary, d.dossierId)).rejects.toMatchObject({ code: "not_in_open_meeting" });
    await meetingWith(w.A.secretary, "Phiên họp chốt lại", [d.dossierId]);
    const again = await finalize(w.A.secretary, d.dossierId);

    expect(again).toMatchObject({ n: 2, dossierState: "score_finalized" });
    const results = await w.t.app.scoring.finalizedResults(w.A.secretary, { dossierId: d.dossierId });
    expect(results.map((r) => [r.n, r.supersededAt !== null, r.sha256])).toEqual([
      [1, true, first.sha256],
      [2, false, (await full(w.A.secretary, d.dossierId)).result!.sha256],
    ]);
    expect((await full(w.A.secretary, d.dossierId)).result).toMatchObject({ n: 2, absent: [] });
  });

  it("is refused when the hồ sơ is not Đã chốt điểm, and needs the văn bản, người yêu cầu and lý do (stories 127, 131)", async () => {
    const d = await w.graded([m(0), m(1)]);
    await scoreAndConfirm(m(0), d.dossierId, [40, 25, 35]);
    await scoreAndConfirm(m(1), d.dossierId, [40, 25, 35]);
    await expect(unlock(d.dossierId)).rejects.toMatchObject({ code: "invalid_state" });
    expect((await w.t.app.dossiers.get(w.A.secretary, { dossierId: d.dossierId })).state).toBe("member_confirmed");
    await expect(w.t.app.scoring.unlockTarget(admin, { code: "HS-1999-0001" })).rejects.toMatchObject({ code: "not_found" });

    const f = await finalized();
    await expect(unlock(f.dossierId, { requestedBy: "  " })).rejects.toMatchObject({ code: "requested_by_required" });
    await expect(unlock(f.dossierId, { reason: "" })).rejects.toMatchObject({ code: "reason_required" });
    const notMine = await w.f.uploadPdf(w.province, "council_decision", "QĐ.pdf");
    await expect(unlock(f.dossierId, { requestFileId: notMine })).rejects.toMatchObject({ code: "file_required" });
    const blocked = await w.f.uploadPdf(admin, "unlock_request", "virus.pdf", { content: Buffer.from(EICAR) });
    await expect(unlock(f.dossierId, { requestFileId: blocked })).rejects.toMatchObject({ code: "file_blocked" });
    expect((await w.t.app.scoring.unlockTarget(admin, { code: f.code })).state).toBe("score_finalized");

    await unlock(f.dossierId);
    await expect(unlock(f.dossierId)).rejects.toMatchObject({ code: "invalid_state" });
  });

  it("asks for Xác thực lại when the last one is older than 5 minutes, and audits the method (stories 127, 134)", async () => {
    const d = await finalized();
    const requestFileId = await requestFile();
    w.t.clock.advance(6 * 60_000);
    await expect(unlock(d.dossierId, { requestFileId })).rejects.toMatchObject({ code: "reauth_required" });
    await w.t.app.identity.reauthenticate(admin, { password: ADMIN.password });
    await unlock(d.dossierId, { requestFileId });

    const [row] = await w.t.app.audit.search(admin, { action: ["dossier.unlock"], targetId: d.dossierId });
    expect(row).toMatchObject({
      actorUserId: admin.userId,
      actorRole: "admin",
      before: { state: "score_finalized" },
      after: { state: "member_confirmed" },
      metadata: { n: 1, requestFileId, requestedBy: "Chủ tịch Hội đồng A", reason: "Sai sót khi chấm tiêu chí 3.1", reauth: { method: "password" } },
    });
  });

  it("tells the Chủ tịch and Thư ký, writes the outbox event in the same transaction, and stays off the Chủ thể's timeline (stories 130, 133)", async () => {
    const d = await finalized();
    await unlock(d.dossierId, { reason: "Lý do nội bộ của Hội đồng" });
    await w.t.drainJobs();

    for (const x of [w.A.chair, w.A.secretary]) {
      const notices = (await w.t.app.notifications.list(x)).filter((n) => n.kind === "dossier_unlocked" && n.link === `/hoi-dong/chot-diem/${d.dossierId}`);
      expect(notices).toHaveLength(1);
      expect(notices[0]!.body).toContain(d.code);
      expect(w.t.mailbox.to(x.email).at(-1)!.text).toContain(`/hoi-dong/chot-diem/${d.dossierId}`);
    }
    for (const x of [m(0), w.B.secretary, w.province]) expect((await w.t.app.notifications.list(x)).filter((n) => n.kind === "dossier_unlocked")).toEqual([]);
    const outbox = await w.db.admin.query("SELECT type FROM platform.outbox WHERE payload->>'dossierId' = $1 AND type = 'dossier.unlocked'", [d.dossierId]);
    expect(outbox.rowCount).toBe(1);
    const timeline = JSON.stringify(await w.t.app.dossiers.timeline(d.a, { dossierId: d.dossierId }));
    expect(timeline).not.toContain("dossier.unlock");
    expect(timeline).not.toContain("Lý do nội bộ");
  });

  it("writes nothing when a step after the move fails: the hồ sơ, kết quả, audit and outbox stay as they were (story 133)", async () => {
    const d = await finalized();
    const requestFileId = await requestFile();
    // A CHECK added for the test refuses the request row, which is written after the move.
    await w.db.admin.query("ALTER TABLE scoring.unlock_request ADD CONSTRAINT unlock_request_test_refusal CHECK (requested_by <> 'Từ chối')");
    try {
      await expect(unlock(d.dossierId, { requestFileId, requestedBy: "Từ chối" })).rejects.toThrow();
    } finally {
      await w.db.admin.query("ALTER TABLE scoring.unlock_request DROP CONSTRAINT unlock_request_test_refusal");
    }
    expect((await w.t.app.dossiers.get(w.A.secretary, { dossierId: d.dossierId })).state).toBe("score_finalized");
    expect((await full(w.A.secretary, d.dossierId)).result).toMatchObject({ n: 1 });
    expect(await w.t.app.audit.search(admin, { action: ["dossier.unlock"], targetId: d.dossierId })).toEqual([]);
    const outbox = await w.db.admin.query("SELECT 1 FROM platform.outbox WHERE payload->>'dossierId' = $1 AND type = 'dossier.unlocked'", [d.dossierId]);
    expect(outbox.rowCount).toBe(0);
  });
});
