import { describe, expect, it } from "vitest";
import { FIVE, FOUR, resultsWorld, THREE } from "./results-world";

/*
 * L17 SO-04 Đề xuất 5 sao (#87, spec #79 stories 46, 53 to 55, 58 to 60, 67; ADR 0009). After the Quyết định công nhận,
 * a hồ sơ 5 sao stays Đã chốt điểm and is listed as Đề xuất 5 sao. The Cán bộ Sở đánh dấu đã gửi (số công văn, ngày
 * gửi) → Đã gửi đề nghị 5 sao; on the Bộ's answer it either chuyển về công nhận cấp tỉnh (the hồ sơ waits for a Quyết
 * định công nhận bổ sung) or đóng hồ sơ (Bộ công nhận 5 sao, or kết quả khác) → Đã đóng, xử lý ngoài hệ thống.
 */
describe("L17 Đề xuất 5 sao (#87)", () => {
  const { w, closedMeeting, record } = resultsWorld();

  const dossier = (dossierId: string) => w.t.app.dossiers.get(w.province, { dossierId });
  const ministryFile = (name = "Văn bản của Bộ.pdf") => w.f.uploadPdf(w.province, "ministry_document", name);

  /** A hồ sơ 5 sao whose Quyết định công nhận is recorded: Đã chốt điểm and Công bố. */
  async function proposed() {
    const { meetingId, dossiers } = await closedMeeting([FIVE]);
    await record(meetingId);
    const d = dossiers[0]!;
    return { ...d, version: (await dossier(d.dossierId)).version };
  }

  async function sent() {
    const d = await proposed();
    const { version } = await w.t.app.results.markFiveStarSent(w.province, {
      dossierId: d.dossierId,
      expectedVersion: d.version,
      dispatchNumber: "45/SNNMT-PTNT",
      sentOn: "2026-10-19",
    });
    return { ...d, version };
  }

  it("lists the hồ sơ 5 sao Công bố, not the others, and moves one to Đã gửi đề nghị 5 sao with its số công văn and ngày gửi (stories 46, 53)", async () => {
    const { meetingId, dossiers } = await closedMeeting([THREE, FOUR, FIVE]);
    const five = dossiers[2]!.dossierId;
    const before = await w.t.app.results.fiveStarList(w.province);
    expect(before.some((r) => r.dossierId === five)).toBe(false);
    await record(meetingId);

    const listed = await w.t.app.results.fiveStarList(w.province);
    const ids = listed.map((r) => r.dossierId);
    expect(ids).toContain(five);
    expect(ids).not.toContain(dossiers[0]!.dossierId);
    expect(ids).not.toContain(dossiers[1]!.dossierId);
    expect(listed.find((r) => r.dossierId === five)).toMatchObject({ state: "score_finalized", star: 5, dispatch: null, awaitingSupplementaryDecision: false });

    const { version } = await w.t.app.results.markFiveStarSent(w.province, {
      dossierId: five,
      expectedVersion: (await dossier(five)).version,
      dispatchNumber: " 45/SNNMT-PTNT ",
      sentOn: "2026-10-18",
    });

    expect(await dossier(five)).toMatchObject({ state: "five_star_proposed", version });
    expect((await w.t.app.results.fiveStarList(w.province)).find((r) => r.dossierId === five)).toMatchObject({
      state: "five_star_proposed",
      dispatch: { number: "45/SNNMT-PTNT", sentOn: "2026-10-18" },
    });
  });

  it("refuses đánh dấu đã gửi without a số công văn or with a ngày gửi missing, invalid or in the future (story 53)", async () => {
    const d = await proposed();
    const mark = (dispatchNumber: string, sentOn: string) =>
      w.t.app.results.markFiveStarSent(w.province, { dossierId: d.dossierId, expectedVersion: d.version, dispatchNumber, sentOn });

    await expect(mark("  ", "2026-10-18")).rejects.toMatchObject({ code: "dispatch_number_required" });
    await expect(mark("45/SNNMT", "")).rejects.toMatchObject({ code: "sent_on_invalid" });
    await expect(mark("45/SNNMT", "2026-02-30")).rejects.toMatchObject({ code: "sent_on_invalid" });
    await expect(mark("45/SNNMT", "2026-10-20")).rejects.toMatchObject({ code: "sent_on_in_future" });
    expect(await dossier(d.dossierId)).toMatchObject({ state: "score_finalized", version: d.version });
  });

  it("refuses đánh dấu đã gửi before Công bố kết quả, or for a hồ sơ not 5 sao (guard of the row)", async () => {
    const { meetingId, dossiers } = await closedMeeting([FIVE, FOUR]);
    const [five, four] = dossiers.map((d) => d.dossierId) as [string, string];
    const mark = async (dossierId: string) =>
      w.t.app.results.markFiveStarSent(w.province, {
        dossierId,
        expectedVersion: (await dossier(dossierId)).version,
        dispatchNumber: "45/SNNMT",
        sentOn: "2026-10-19",
      });

    await expect(mark(five)).rejects.toMatchObject({ code: "result_not_published" });
    await record(meetingId);
    // Công nhận 4 sao has no such row.
    await expect(mark(four)).rejects.toMatchObject({ code: "invalid_state" });
    await expect(mark(five)).resolves.toBeDefined();
    // Once sent, never again.
    await expect(mark(five)).rejects.toMatchObject({ code: "invalid_state" });
  });

  it("refuses a stale version", async () => {
    const d = await proposed();
    await expect(
      w.t.app.results.markFiveStarSent(w.province, {
        dossierId: d.dossierId,
        expectedVersion: d.version - 1,
        dispatchNumber: "45/SNNMT",
        sentOn: "2026-10-19",
      }),
    ).rejects.toMatchObject({ code: "version_conflict" });
  });

  it("chuyển về công nhận cấp tỉnh sets the cờ chờ Quyết định công nhận bổ sung with the Bộ's văn bản, once; the list filters on it (stories 54, 55)", async () => {
    const a = await sent();
    const b = await sent();
    const fileId = await ministryFile("Công văn Bộ trả về.pdf");

    const { version } = await w.t.app.results.returnFiveStarToProvince(w.province, { dossierId: a.dossierId, expectedVersion: a.version, fileId });

    expect(await dossier(a.dossierId)).toMatchObject({
      state: "five_star_proposed",
      version,
      awaitingSupplementaryDecision: true,
      ministryReturnFileId: fileId,
    });
    const awaiting = (await w.t.app.results.fiveStarList(w.province, { awaiting: true })).map((r) => r.dossierId);
    expect(awaiting).toContain(a.dossierId);
    expect(awaiting).not.toContain(b.dossierId);
    expect((await w.t.app.results.fiveStarList(w.province)).find((r) => r.dossierId === a.dossierId)).toMatchObject({
      awaitingSupplementaryDecision: true,
      returnFile: { id: fileId, fileName: "Công văn Bộ trả về.pdf" },
    });

    const again = await ministryFile();
    await expect(
      w.t.app.results.returnFiveStarToProvince(w.province, { dossierId: a.dossierId, expectedVersion: version, fileId: again }),
    ).rejects.toMatchObject({
      code: "awaiting_supplementary_decision",
    });
    // Waiting for the quyết định bổ sung, it is not closed either.
    await expect(
      w.t.app.results.closeFiveStar(w.province, { dossierId: a.dossierId, expectedVersion: version, outcome: "other", fileId: again }),
    ).rejects.toMatchObject({ code: "awaiting_supplementary_decision" });
  });

  it("refuses chuyển về before đánh dấu đã gửi, or without the Bộ's văn bản", async () => {
    const d = await proposed();
    const fileId = await ministryFile();
    await expect(w.t.app.results.returnFiveStarToProvince(w.province, { dossierId: d.dossierId, expectedVersion: d.version, fileId })).rejects.toMatchObject({
      code: "invalid_state",
    });
    const s = await sent();
    await expect(
      w.t.app.results.returnFiveStarToProvince(w.province, {
        dossierId: s.dossierId,
        expectedVersion: s.version,
        fileId: "0197a2b4-0000-7000-8000-000000000000",
      }),
    ).rejects.toMatchObject({ code: "file_required" });
  });

  it("đóng hồ sơ with Bộ công nhận 5 sao needs số, ngày quyết định and the văn bản; it becomes Đã đóng, xử lý ngoài hệ thống (story 58)", async () => {
    const d = await sent();
    const fileId = await ministryFile("QĐ Bộ công nhận 5 sao.pdf");
    const close = (input: { decisionNumber?: string; decidedOn?: string; fileId?: string }) =>
      w.t.app.results.closeFiveStar(w.province, {
        dossierId: d.dossierId,
        expectedVersion: d.version,
        outcome: "ministry_recognized_5_star",
        fileId,
        ...input,
      });

    await expect(close({ decisionNumber: "", decidedOn: "2026-10-19" })).rejects.toMatchObject({ code: "decision_number_required" });
    await expect(close({ decisionNumber: "789/QĐ-BNNMT" })).rejects.toMatchObject({ code: "decided_on_invalid" });
    await expect(close({ decisionNumber: "789/QĐ-BNNMT", decidedOn: "2026-11-01" })).rejects.toMatchObject({ code: "decided_on_in_future" });
    await expect(close({ decisionNumber: "789/QĐ-BNNMT", decidedOn: "2026-10-19", fileId: "" })).rejects.toMatchObject({ code: "file_required" });

    const { version } = await close({ decisionNumber: " 789/QĐ-BNNMT ", decidedOn: "2026-10-19" });

    expect(await dossier(d.dossierId)).toMatchObject({ state: "closed_offline", version });
    const closure = await w.db.admin.query("SELECT outcome, decision_number, decided_on::text, file_id FROM results.five_star_closure WHERE dossier_id = $1", [
      d.dossierId,
    ]);
    expect(closure.rows).toEqual([{ outcome: "ministry_recognized_5_star", decision_number: "789/QĐ-BNNMT", decided_on: "2026-10-19", file_id: fileId }]);
    expect((await w.t.app.results.fiveStarList(w.province)).some((r) => r.dossierId === d.dossierId)).toBe(false);
  });

  it("đóng hồ sơ with kết quả khác needs only the văn bản of the Bộ (story 59)", async () => {
    const d = await sent();
    await expect(
      w.t.app.results.closeFiveStar(w.province, { dossierId: d.dossierId, expectedVersion: d.version, outcome: "other", fileId: "" }),
    ).rejects.toMatchObject({ code: "file_required" });
    await expect(
      w.t.app.results.closeFiveStar(w.province, { dossierId: d.dossierId, expectedVersion: d.version, outcome: "bogus" as never, fileId: "" }),
    ).rejects.toMatchObject({ code: "closure_outcome_invalid" });
    const fileId = await ministryFile();

    await w.t.app.results.closeFiveStar(w.province, { dossierId: d.dossierId, expectedVersion: d.version, outcome: "other", fileId });

    expect(await dossier(d.dossierId)).toMatchObject({ state: "closed_offline" });
    const closure = await w.db.admin.query("SELECT outcome, decision_number, decided_on FROM results.five_star_closure WHERE dossier_id = $1", [d.dossierId]);
    expect(closure.rows).toEqual([{ outcome: "other", decision_number: null, decided_on: null }]);
  });

  it("writes audit, outbox events and the Chủ thể's timeline mốc of each step in the same transaction (story 67)", async () => {
    const d = await sent();
    await w.t.app.results.returnFiveStarToProvince(w.province, { dossierId: d.dossierId, expectedVersion: d.version, fileId: await ministryFile() });
    const c = await sent();
    await w.t.app.results.closeFiveStar(w.province, { dossierId: c.dossierId, expectedVersion: c.version, outcome: "other", fileId: await ministryFile() });

    const events = await w.db.admin.query(
      "SELECT type, payload->>'dossierId' AS id FROM platform.outbox WHERE type LIKE 'dossier.five_star_%' AND payload->>'dossierId' = ANY($1)",
      [[d.dossierId, c.dossierId]],
    );
    expect(events.rows).toEqual(
      expect.arrayContaining([
        { type: "dossier.five_star_sent", id: d.dossierId },
        { type: "dossier.five_star_returned", id: d.dossierId },
        { type: "dossier.five_star_sent", id: c.dossierId },
        { type: "dossier.five_star_closed", id: c.dossierId },
      ]),
    );
    expect(events.rowCount).toBe(4);
    const audit = await w.db.admin.query(
      "SELECT action, actor_user_id FROM platform.audit_log WHERE target_id = ANY($1) AND action LIKE 'dossier.five_star.%'",
      [[d.dossierId, c.dossierId]],
    );
    expect(audit.rows.map((r) => r.action).sort()).toEqual([
      "dossier.five_star.close",
      "dossier.five_star.mark_sent",
      "dossier.five_star.mark_sent",
      "dossier.five_star.return_to_province",
    ]);
    expect(audit.rows.every((r) => r.actor_user_id === w.province.userId)).toBe(true);

    const timeline = (await w.t.app.dossiers.timeline(d.a, { dossierId: d.dossierId })).map((e) => e.action);
    expect(timeline).toEqual(expect.arrayContaining(["dossier.five_star.mark_sent", "dossier.five_star.return_to_province"]));
    const closedTimeline = (await w.t.app.dossiers.timeline(c.a, { dossierId: c.dossierId })).map((e) => e.action);
    expect(closedTimeline).toEqual(expect.arrayContaining(["dossier.five_star.mark_sent", "dossier.five_star.close"]));
  });

  it("leaves nothing behind when đóng hồ sơ fails after the state changed (one transaction)", async () => {
    const d = await sent();
    const other = await sent();
    const fileId = await ministryFile();
    await w.t.app.results.closeFiveStar(w.province, { dossierId: other.dossierId, expectedVersion: other.version, outcome: "other", fileId });

    // The văn bản of one closure cannot be that of another (unique file_id): the closure insert fails after the transition.
    await expect(w.t.app.results.closeFiveStar(w.province, { dossierId: d.dossierId, expectedVersion: d.version, outcome: "other", fileId })).rejects.toThrow();

    expect(await dossier(d.dossierId)).toMatchObject({ state: "five_star_proposed", version: d.version });
    const events = await w.db.admin.query("SELECT 1 FROM platform.outbox WHERE type = 'dossier.five_star_closed' AND payload->>'dossierId' = $1", [
      d.dossierId,
    ]);
    expect(events.rowCount).toBe(0);
  });

  it("tells the Chủ thể in the app and by email when the Bộ công nhận 5 sao, not on kết quả khác (story 58)", async () => {
    const yes = await sent();
    const no = await sent();
    await w.t.drainJobs();

    await w.t.app.results.closeFiveStar(w.province, {
      dossierId: yes.dossierId,
      expectedVersion: yes.version,
      outcome: "ministry_recognized_5_star",
      decisionNumber: "789/QĐ-BNNMT",
      decidedOn: "2026-10-19",
      fileId: await ministryFile(),
    });
    await w.t.app.results.closeFiveStar(w.province, { dossierId: no.dossierId, expectedVersion: no.version, outcome: "other", fileId: await ministryFile() });
    await w.t.drainJobs();

    const inbox = await w.t.app.notifications.list(yes.a);
    expect(inbox.some((n) => n.kind === "dossier_five_star_recognized" && n.link === `/chu-the/ho-so/${yes.dossierId}`)).toBe(true);
    const mail = w.t.mailbox.to(yes.a.email).filter((e) => e.subject === "Hồ sơ OCOP được Bộ công nhận 5 sao");
    expect(mail).toHaveLength(1);
    expect(mail[0]!.text).toContain(`/chu-the/ho-so/${yes.dossierId}`);
    expect((await w.t.app.notifications.list(no.a)).some((n) => n.kind === "dossier_five_star_recognized")).toBe(false);
    expect(w.t.mailbox.to(no.a.email).some((e) => e.subject === "Hồ sơ OCOP được Bộ công nhận 5 sao")).toBe(false);
  });

  it("shows the Chủ thể where its hồ sơ 5 sao stands: sent, returned, closed (story 60)", async () => {
    const standing = async (d: Awaited<ReturnType<typeof sent>>) => {
      const view = await w.t.app.scoring.readDossierScores(d.a, { dossierId: d.dossierId });
      if (view.kind !== "published_result") throw new Error(`expected published_result, got ${view.kind}`);
      return view.standing;
    };
    const d = await sent();
    expect(await standing(d)).toBe("Tỉnh đã gửi đề nghị Trung ương đánh giá 5 sao");
    await w.t.app.results.returnFiveStarToProvince(w.province, { dossierId: d.dossierId, expectedVersion: d.version, fileId: await ministryFile() });
    expect(await standing(d)).toBe("Trung ương chuyển về, chờ tỉnh công nhận 4 sao");
    const c = await sent();
    await w.t.app.results.closeFiveStar(w.province, {
      dossierId: c.dossierId,
      expectedVersion: c.version,
      outcome: "ministry_recognized_5_star",
      decisionNumber: "789/QĐ-BNNMT",
      decidedOn: "2026-10-19",
      fileId: await ministryFile(),
    });
    expect(await standing(c)).toBe("Bộ công nhận 5 sao");
    const o = await sent();
    await w.t.app.results.closeFiveStar(w.province, { dossierId: o.dossierId, expectedVersion: o.version, outcome: "other", fileId: await ministryFile() });
    expect(await standing(o)).toBe("Đã đóng theo văn bản của Bộ");
  });

  it("the database refuses changing or removing what was recorded (append-only)", async () => {
    const d = await sent();
    await expect(w.db.app.query("UPDATE results.five_star_dispatch SET dispatch_number = 'x' WHERE dossier_id = $1", [d.dossierId])).rejects.toThrow();
    await expect(w.db.admin.query("DELETE FROM results.five_star_dispatch WHERE dossier_id = $1", [d.dossierId])).rejects.toThrow(/never changes/);
    await w.t.app.results.closeFiveStar(w.province, { dossierId: d.dossierId, expectedVersion: d.version, outcome: "other", fileId: await ministryFile() });
    await expect(
      w.db.admin.query("UPDATE results.five_star_closure SET outcome = 'ministry_recognized_5_star' WHERE dossier_id = $1", [d.dossierId]),
    ).rejects.toThrow();
    await expect(w.db.admin.query("DELETE FROM results.five_star_closure WHERE dossier_id = $1", [d.dossierId])).rejects.toThrow(/never changes/);
  });

  it("gives the Cán bộ Sở a download link for the Bộ's văn bản of the hồ sơ, and only those", async () => {
    const d = await sent();
    const fileId = await ministryFile();
    await w.t.app.results.returnFiveStarToProvince(w.province, { dossierId: d.dossierId, expectedVersion: d.version, fileId });

    await expect(w.t.app.results.downloadMinistryDocument(w.province, { dossierId: d.dossierId, fileId })).resolves.toMatchObject({ url: expect.any(String) });
    const stranger = await ministryFile();
    await expect(w.t.app.results.downloadMinistryDocument(w.province, { dossierId: d.dossierId, fileId: stranger })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
