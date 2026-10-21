import { describe, expect, it } from "vitest";
import { snapshotHash, type DossierScores, type UserActor } from "@ocop/core";
import { PASSWORD } from "../dossiers/fixtures";
import { scoringWorld } from "./world";

/*
 * L15 HD-08, TV-08 (#60, spec #49 stories 107 to 109, 116 to 126): the Chủ tịch or Thư ký lập a Phiên họp of
 * the Hội đồng in a đợt with hồ sơ Sẵn sàng chốt, then chốt each one after Xác thực lại. A phiếu not confirmed
 * by then is Vắng; the kết quả chốt keeps the điểm tổng hợp, Hạng sao, unmet Sao tối thiểu, Cờ chênh lệch, the
 * phiếu counted, a snapshot and its SHA-256, and never changes (ADR 0008). The hồ sơ goes to Đã chốt điểm.
 * Bộ tiêu chí of the world: 1.1 (A, 0/20/40, Sao tối thiểu 3 needs 20), 2.1 (B, 0/25), 3.1 (C, 0/35).
 */
describe("L15 Phiên họp and chốt điểm (#60)", () => {
  const w = scoringWorld({ minGraders: 2 });
  const m = (i: number) => w.A.members[i]!;

  async function scoreAndConfirm(actor: UserActor, dossierId: string, [a, b, c]: [number, number, number]) {
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "own_sheet") throw new Error(`expected own_sheet, got ${view.kind}`);
    const lines = (
      [
        ["1.1", a],
        ["2.1", b],
        ["3.1", c],
      ] as const
    ).map(([code, points]) => ({ criterionId: w.criterionId(code), levelId: w.level(`${code}:${points}`), comment: "", evidenceFileIds: [] }));
    const { version } = await w.t.app.scoring.saveScoreSheet(actor, { dossierId, expectedVersion: view.sheet!.version, lines });
    await w.t.app.scoring.confirmScoreSheet(actor, { dossierId, expectedVersion: version });
  }

  /** A hồ sơ Giao chấm to thành viên 0, 1 and 2, of whom 0 and 1 confirmed (Sẵn sàng chốt) and 2 left a nháp. */
  async function ready() {
    const d = await w.graded([m(0), m(1), m(2)]);
    await scoreAndConfirm(m(0), d.dossierId, [40, 25, 35]);
    await scoreAndConfirm(m(1), d.dossierId, [20, 25, 0]);
    return d;
  }

  const full = async (actor: UserActor, dossierId: string) => {
    const view: DossierScores = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "full") throw new Error(`expected full, got ${view.kind}`);
    return view;
  };

  const meetingWith = (actor: UserActor, dossierIds: string[]) =>
    w.t.app.scoring.createMeeting(actor, { roundId: w.roundId, title: "Phiên họp thứ nhất", heldOn: "2026-10-25", location: "Phòng họp Sở", dossierIds });

  it("chốt a hồ sơ of an open Phiên họp: Đã chốt điểm, the nháp is Vắng, and the kết quả is stored with its hash (stories 116 to 120)", async () => {
    const d = await ready();
    await meetingWith(w.A.secretary, [d.dossierId]);
    const before = await full(w.A.secretary, d.dossierId);

    const done = await w.t.app.scoring.finalize(w.A.secretary, { dossierId: d.dossierId, expectedVersion: before.dossierVersion });

    expect(done).toMatchObject({ n: 1, star: 4, total: 72.5 });
    const after = await full(w.A.secretary, d.dossierId);
    expect(after.dossierState).toBe("score_finalized");
    expect(after.aggregate).toMatchObject({ total: 72.5, star: 4, sheetCount: 2, deviation: 55, flagged: true });
    expect(after.graders.find((g) => g.userId === m(2).userId)).toMatchObject({ state: "absent", total: null });
    expect(after.result).toMatchObject({ n: 1, reauthMethod: "password", finalizedBy: { userId: w.A.secretary.userId } });
    expect(after.result!.absent).toEqual([expect.objectContaining({ userId: m(2).userId })]);
    expect(snapshotHash(after.result!.snapshot)).toBe(after.result!.sha256);
  });

  it("is refused while the hồ sơ is not Sẵn sàng chốt, or not in an open Phiên họp (story 117)", async () => {
    const early = await w.graded([m(0), m(1), m(2)]);
    await scoreAndConfirm(m(0), early.dossierId, [40, 25, 35]);
    const { version } = await w.t.app.dossiers.get(w.A.chair, { dossierId: early.dossierId });
    await meetingWith(w.A.chair, []);
    await expect(w.t.app.scoring.finalize(w.A.chair, { dossierId: early.dossierId, expectedVersion: version })).rejects.toMatchObject({ code: "invalid_state" });

    const d = await ready();
    const { dossierVersion } = await full(w.A.chair, d.dossierId);
    await expect(w.t.app.scoring.finalize(w.A.chair, { dossierId: d.dossierId, expectedVersion: dossierVersion })).rejects.toMatchObject({ code: "not_in_open_meeting" });
    expect((await full(w.A.chair, d.dossierId)).dossierState).toBe("member_confirmed");
  });

  it("asks for Xác thực lại when the last one is older than 5 minutes, and records the method (stories 116, 134)", async () => {
    const d = await ready();
    await meetingWith(w.A.chair, [d.dossierId]);
    const { dossierVersion } = await full(w.A.chair, d.dossierId);
    w.t.clock.advance(6 * 60_000);

    await expect(w.t.app.scoring.finalize(w.A.chair, { dossierId: d.dossierId, expectedVersion: dossierVersion })).rejects.toMatchObject({ code: "reauth_required" });
    await w.t.app.identity.reauthenticate(w.A.chair, { password: PASSWORD });
    await w.t.app.scoring.finalize(w.A.chair, { dossierId: d.dossierId, expectedVersion: dossierVersion });

    expect((await full(w.A.chair, d.dossierId)).result).toMatchObject({ reauthMethod: "password", finalizedBy: { userId: w.A.chair.userId } });
  });

  it("after chốt shows every thành viên chấm the kết quả, tells them, and gives the Chủ thể a timeline row and the Sở the state only (stories 121, 122, 124, 125, 137)", async () => {
    const d = await ready();
    await meetingWith(w.A.secretary, [d.dossierId]);
    await w.t.app.scoring.finalize(w.A.secretary, { dossierId: d.dossierId, expectedVersion: (await full(w.A.secretary, d.dossierId)).dossierVersion });

    // The Vắng thành viên too, though they never confirmed (TV-08); their own phiếu stays theirs on S61.
    expect((await full(m(2), d.dossierId)).result).toMatchObject({ n: 1 });
    expect((await full(m(0), d.dossierId)).aggregate.total).toBe(72.5);
    expect((await w.t.app.scoring.readDossierScores(m(2), { dossierId: d.dossierId, ownSheet: true })).kind).toBe("own_sheet");
    await expect(w.t.app.scoring.readDossierScores(m(3), { dossierId: d.dossierId })).rejects.toMatchObject({ code: "not_found" });
    for (const reader of [w.province, w.ward, d.a]) expect(await w.t.app.scoring.readDossierScores(reader, { dossierId: d.dossierId })).toEqual({ kind: "none" });
    expect(await w.t.app.dossiers.get(w.province, { dossierId: d.dossierId })).toMatchObject({ state: "score_finalized" });

    const timeline = await w.t.app.dossiers.timeline(d.a, { dossierId: d.dossierId });
    expect(timeline.find((e) => e.action === "dossier.finalize")).toMatchObject({ fromState: "member_confirmed", toState: "score_finalized", metadata: { n: 1 } });
    const text = JSON.stringify(timeline);
    for (const x of [m(0), m(1), m(2)]) expect(text).not.toContain(x.fullName);
    expect(text).not.toContain("72.5");

    await w.t.drainJobs();
    for (const x of [m(0), m(1), m(2)]) {
      expect((await w.t.app.notifications.list(x)).filter((n) => n.kind === "dossier_score_finalized" && n.link === `/thanh-vien/diem-tong-hop/${d.dossierId}`)).toHaveLength(1);
    }
    expect((await w.t.app.notifications.list(m(3))).filter((n) => n.kind === "dossier_score_finalized")).toEqual([]);
    const [audited] = await w.t.app.audit.search(await w.f.admin(), { action: ["scoring.result.finalized"], targetId: d.dossierId });
    expect(audited).toMatchObject({ metadata: { reauth: { method: "password" } }, after: { n: 1, star: 4 } });
  });

  describe("Phiên họp (stories 107 to 109)", () => {
    it("lists the hồ sơ Sẵn sàng chốt not yet in a Phiên họp, and adds or gỡ them while open", async () => {
      const one = await ready();
      const two = await ready();
      const { meetingId } = await meetingWith(w.A.secretary, [one.dossierId]);

      const view = await w.t.app.scoring.getMeeting(w.A.chair, { meetingId });
      expect(view).toMatchObject({ title: "Phiên họp thứ nhất", heldOn: "2026-10-25", location: "Phòng họp Sở", state: "open", dossierCount: 1, finalizedCount: 0 });
      expect(view.dossiers.map((d) => d.dossierId)).toEqual([one.dossierId]);
      expect(view.candidates.map((c) => c.dossierId)).toContain(two.dossierId);
      expect(view.candidates.map((c) => c.dossierId)).not.toContain(one.dossierId);

      await w.t.app.scoring.addMeetingDossiers(w.A.chair, { meetingId, dossierIds: [two.dossierId] });
      await w.t.app.scoring.removeMeetingDossier(w.A.secretary, { meetingId, dossierId: one.dossierId });
      expect((await w.t.app.scoring.getMeeting(w.A.secretary, { meetingId })).dossiers.map((d) => d.dossierId)).toEqual([two.dossierId]);
      expect((await w.t.app.scoring.listMeetings(w.A.secretary, { roundId: w.roundId })).find((x) => x.id === meetingId)).toMatchObject({ dossierCount: 1 });
    });

    it("keeps a hồ sơ in one open Phiên họp at a time, and only a hồ sơ Sẵn sàng chốt joins one", async () => {
      const d = await ready();
      await meetingWith(w.A.secretary, [d.dossierId]);
      await expect(meetingWith(w.A.chair, [d.dossierId])).rejects.toMatchObject({ code: "already_in_meeting" });

      const early = await w.graded([m(0), m(1)]);
      const { meetingId } = await meetingWith(w.A.chair, []);
      await expect(w.t.app.scoring.addMeetingDossiers(w.A.chair, { meetingId, dossierIds: [early.dossierId] })).rejects.toMatchObject({ code: "not_ready_to_finalize" });
    });

    it("closes once each hồ sơ is chốt or gỡ; a hồ sơ chốt stays and a closed Phiên họp takes no more", async () => {
      const kept = await ready();
      const dropped = await ready();
      const { meetingId } = await meetingWith(w.A.secretary, [kept.dossierId, dropped.dossierId]);
      await expect(w.t.app.scoring.closeMeeting(w.A.secretary, { meetingId })).rejects.toMatchObject({ code: "meeting_has_pending_dossiers" });

      const { dossierVersion } = await full(w.A.secretary, kept.dossierId);
      await w.t.app.scoring.finalize(w.A.secretary, { dossierId: kept.dossierId, expectedVersion: dossierVersion });
      await expect(w.t.app.scoring.removeMeetingDossier(w.A.secretary, { meetingId, dossierId: kept.dossierId })).rejects.toMatchObject({ code: "not_in_meeting" });
      await w.t.app.scoring.removeMeetingDossier(w.A.secretary, { meetingId, dossierId: dropped.dossierId });
      await w.t.app.scoring.closeMeeting(w.A.chair, { meetingId });

      const view = await w.t.app.scoring.getMeeting(w.A.secretary, { meetingId });
      expect(view).toMatchObject({ state: "closed", dossierCount: 1, finalizedCount: 1, candidates: [] });
      expect(view.dossiers[0]).toMatchObject({ dossierId: kept.dossierId, state: "score_finalized", result: { n: 1, star: 4, total: 72.5, flagged: true } });
      await expect(w.t.app.scoring.addMeetingDossiers(w.A.secretary, { meetingId, dossierIds: [dropped.dossierId] })).rejects.toMatchObject({ code: "meeting_closed" });
    });

    it("is the Hội đồng's own: another Hội đồng finds neither the Phiên họp nor the hồ sơ, and a đợt not gán to it is refused", async () => {
      const d = await ready();
      const { meetingId } = await meetingWith(w.A.secretary, [d.dossierId]);
      await expect(w.t.app.scoring.getMeeting(w.B.secretary, { meetingId })).rejects.toMatchObject({ code: "not_found" });
      await expect(w.t.app.scoring.closeMeeting(w.B.chair, { meetingId })).rejects.toMatchObject({ code: "not_found" });
      await expect(
        w.t.app.scoring.createMeeting(w.B.secretary, { roundId: w.roundId, title: "Họp", heldOn: "2026-10-25", location: "Sở", dossierIds: [] }),
      ).rejects.toMatchObject({ code: "not_found" });
      expect(await w.t.app.scoring.listMeetings(w.B.chair)).toEqual([]);
    });
  });

  it("refuses the second of two chốt made from the same version (version)", async () => {
    const d = await ready();
    await meetingWith(w.A.secretary, [d.dossierId]);
    const { dossierVersion } = await full(w.A.secretary, d.dossierId);

    await w.t.app.scoring.finalize(w.A.chair, { dossierId: d.dossierId, expectedVersion: dossierVersion });
    await expect(w.t.app.scoring.finalize(w.A.secretary, { dossierId: d.dossierId, expectedVersion: dossierVersion })).rejects.toMatchObject({ code: "version_conflict" });
    expect((await full(w.A.secretary, d.dossierId)).result).toMatchObject({ n: 1, finalizedBy: { userId: w.A.chair.userId } });
  });
});
