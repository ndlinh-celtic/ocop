import { describe, expect, it } from "vitest";
import { FIVE, FOUR, resultsWorld, THREE, TWO } from "./results-world";

/*
 * L16 HD-11 (#83, spec #79 stories 9 to 16, 19): the Cán bộ Sở ghi nhận the signed Quyết định công nhận of a closed
 * Phiên họp. Its hồ sơ 3 and 4 sao become Công nhận 3/4 sao, its hồ sơ 5 sao stay Đã chốt điểm in the mục "đạt điểm đề
 * nghị Trung ương đánh giá, phân hạng 5 sao", its hồ sơ dưới 3 sao are untouched; every hồ sơ named is Công bố kết quả.
 */
describe("L16 Quyết định công nhận of a Phiên họp (#83)", () => {
  const { w, meetingOf, finalize, closedMeeting, record, decisionFile } = resultsWorld();

  const dossier = (dossierId: string) => w.t.app.dossiers.get(w.province, { dossierId });

  it("recognizes the hồ sơ 3 and 4 sao, keeps the 5 sao Đã chốt điểm, leaves the dưới 3 sao alone, and publishes the named ones (stories 9, 14 to 16)", async () => {
    const { meetingId, dossiers } = await closedMeeting([THREE, FOUR, FIVE, TWO]);
    const [three, four, five, two] = dossiers.map((d) => d.dossierId) as [string, string, string, string];
    const twoBefore = await dossier(two);
    const at = w.t.clock.now();

    const decision = await record(meetingId, w.province, { number: "123/QĐ-UBND", signedOn: "2026-10-19" });

    expect(decision.dossiers).toEqual(
      expect.arrayContaining([
        { dossierId: three, section: "three_star" },
        { dossierId: four, section: "four_star" },
        { dossierId: five, section: "five_star_proposal" },
      ]),
    );
    expect(decision.dossiers).toHaveLength(3);
    expect(await dossier(three)).toMatchObject({ state: "recognized", resultPublishedAt: at });
    expect(await dossier(four)).toMatchObject({ state: "recognized", resultPublishedAt: at });
    expect(await dossier(five)).toMatchObject({ state: "score_finalized", resultPublishedAt: at });
    // Story 16: not named, not changed at all.
    expect(await dossier(two)).toEqual(twoBefore);

    const view = await w.t.app.results.meetingDecision(w.province, { meetingId });
    expect(view.decision).toMatchObject({
      id: decision.decisionId,
      kind: "meeting",
      number: "123/QĐ-UBND",
      signedOn: "2026-10-19",
      recordedBy: { userId: w.province.userId },
    });
    expect(view.dossiers.map((d) => [d.dossierId, d.section])).toEqual(
      expect.arrayContaining([
        [three, "three_star"],
        [four, "four_star"],
        [five, "five_star_proposal"],
        [two, null],
      ]),
    );
  });

  it("writes the audit row, a dossier.result_published event per hồ sơ named with its outcome, and a timeline mốc for the Chủ thể, in the same transaction (story 67)", async () => {
    const { meetingId, dossiers } = await closedMeeting([THREE, FIVE]);
    const [three, five] = dossiers;

    const { decisionId } = await record(meetingId);

    const audit = await w.db.admin.query(
      "SELECT actor_user_id, metadata FROM platform.audit_log WHERE action = 'results.decision.recorded' AND target_id = $1",
      [decisionId],
    );
    expect(audit.rows).toEqual([expect.objectContaining({ actor_user_id: w.province.userId })]);
    const events = await w.db.admin.query(
      "SELECT payload->>'dossierId' AS id, payload->>'outcome' AS outcome FROM platform.outbox WHERE type = 'dossier.result_published' AND payload->>'dossierId' = ANY($1)",
      [dossiers.map((d) => d.dossierId)],
    );
    expect(events.rows).toEqual(
      expect.arrayContaining([
        { id: three!.dossierId, outcome: "recognized" },
        { id: five!.dossierId, outcome: "five_star_proposal" },
      ]),
    );
    expect(events.rowCount).toBe(2);
    const timeline = await w.t.app.dossiers.timeline(three!.a, { dossierId: three!.dossierId });
    expect(timeline.some((e) => e.action === "dossier.recognize")).toBe(true);
    const fiveTimeline = await w.t.app.dossiers.timeline(five!.a, { dossierId: five!.dossierId });
    expect(fiveTimeline.some((e) => e.action === "dossier.result_publish")).toBe(true);
  });

  it("tells the Chủ thể in the app and by email, with a link and no điểm (story 63)", async () => {
    const { meetingId, dossiers } = await closedMeeting([FOUR]);
    const [four] = dossiers;

    await record(meetingId);
    await w.t.drainJobs();

    const inbox = await w.t.app.notifications.list(four!.a);
    expect(inbox.some((n) => n.kind === "dossier_result_published" && n.link === `/chu-the/ho-so/${four!.dossierId}`)).toBe(true);
    const mail = w.t.mailbox.to(four!.a.email).filter((e) => e.subject === "Hồ sơ OCOP đã có kết quả");
    expect(mail).toHaveLength(1);
    expect(mail[0]!.text).toContain(`/chu-the/ho-so/${four!.dossierId}`);
    expect(mail[0]!.text).not.toMatch(/72,5|72\.5/);
  });

  it("refuses a Phiên họp not yet closed (story 10)", async () => {
    const { meetingId, dossiers } = await meetingOf([THREE]);
    await finalize(dossiers[0]!.dossierId);

    await expect(record(meetingId)).rejects.toMatchObject({ code: "meeting_not_closed" });
  });

  it("refuses a Phiên họp with a hồ sơ whose kết quả a Mở khóa superseded, listing it (story 11)", async () => {
    const { meetingId, dossiers } = await closedMeeting([THREE, FOUR]);
    const [, four] = dossiers;
    const code = (await dossier(four!.dossierId)).code;
    // A Mở khóa sau chốt after the Phiên họp closed leaves its row without a kết quả hiện hành.
    await w.db.admin.query("UPDATE scoring.aggregate_result SET superseded_at = now() WHERE dossier_id = $1", [four!.dossierId]);

    const err = await record(meetingId).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "meeting_has_pending_dossiers", dossiers: [{ dossierId: four!.dossierId, code }] });
    expect((err as Error).message).toContain(code);
  });

  it("refuses a Phiên họp with no hồ sơ from 3 sao (story 13)", async () => {
    const { meetingId, dossiers } = await closedMeeting([TWO]);

    await expect(record(meetingId)).rejects.toMatchObject({ code: "decision_without_recognized" });
    expect((await dossier(dossiers[0]!.dossierId)).resultPublishedAt).toBeNull();
  });

  it("refuses a second Quyết định công nhận for the same Phiên họp (story 12)", async () => {
    const { meetingId } = await closedMeeting([THREE]);
    await record(meetingId);

    await expect(record(meetingId, w.province, { number: "124/QĐ-UBND" })).rejects.toMatchObject({ code: "meeting_already_has_decision" });
  });

  it("checks the conditions in the spec's order: a hồ sơ chờ chốt is reported before the quyết định already recorded (#79)", async () => {
    const { meetingId, dossiers } = await closedMeeting([THREE, FOUR]);
    await record(meetingId);
    await w.db.admin.query("UPDATE scoring.aggregate_result SET superseded_at = now() WHERE dossier_id = $1", [dossiers[1]!.dossierId]);

    await expect(record(meetingId, w.province, { number: "124/QĐ-UBND" })).rejects.toMatchObject({ code: "meeting_has_pending_dossiers" });
  });

  it("requires a số, a ngày ký not in the future and the Cán bộ Sở's own clean PDF (story 9)", async () => {
    const { meetingId } = await closedMeeting([THREE]);
    const fileId = await decisionFile();
    const input = { meetingId, number: "125/QĐ-UBND", signedOn: "2026-10-19", fileId };

    await expect(w.t.app.results.recordMeetingDecision(w.province, { ...input, number: "  " })).rejects.toMatchObject({ code: "decision_number_required" });
    await expect(w.t.app.results.recordMeetingDecision(w.province, { ...input, signedOn: "27/10/2026" })).rejects.toMatchObject({ code: "signed_on_invalid" });
    await expect(w.t.app.results.recordMeetingDecision(w.province, { ...input, signedOn: "2026-10-15" })).resolves.toBeDefined();
    const { meetingId: other } = await closedMeeting([THREE]);
    await expect(w.t.app.results.recordMeetingDecision(w.province, { ...input, meetingId: other, signedOn: "2026-10-20" })).rejects.toMatchObject({
      code: "signed_on_in_future",
    });
    const otherOfficer = await w.f.staff("province_officer");
    await expect(w.t.app.results.recordMeetingDecision(otherOfficer, { ...input, meetingId: other })).rejects.toMatchObject({ code: "file_required" });
  });

  it("lets nobody cancel it: the DB refuses deleting the decision or changing its hồ sơ (story 19)", async () => {
    const { meetingId } = await closedMeeting([THREE]);
    const { decisionId } = await record(meetingId);

    await expect(w.db.app.query("DELETE FROM results.recognition_decision WHERE id = $1", [decisionId])).rejects.toThrow();
    await expect(w.db.app.query("DELETE FROM results.recognition_decision_dossier WHERE decision_id = $1", [decisionId])).rejects.toThrow();
    await expect(
      w.db.app.query("UPDATE results.recognition_decision_dossier SET section = 'four_star' WHERE decision_id = $1", [decisionId]),
    ).rejects.toThrow();
    await expect(
      w.db.app.query(
        "UPDATE dossier.dossier SET result_published_at = NULL, version = version + 1 WHERE id IN (SELECT dossier_id FROM results.recognition_decision_dossier WHERE decision_id = $1)",
        [decisionId],
      ),
    ).rejects.toThrow();
  });
});
