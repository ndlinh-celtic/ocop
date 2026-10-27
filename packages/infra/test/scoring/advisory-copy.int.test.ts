import { describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { scoringWorld } from "./world";

/*
 * L12 TM-08, TM-09 and L13 TV-02, TV-03, TV-04 (#58, spec #49 stories 65 to 77, 81, 84, 85): a Thành viên Tổ tư
 * vấn sao chép the Điểm đề xuất of an issued Báo cáo Tổ tư vấn phiên bản into the Phiếu chấm of the thành viên
 * chấm, after a xem trước. The first sao chép opens grading; a later one goes Tiêu chí by Tiêu chí, keeping what a
 * thành viên changed, and a Phiếu chấm đã xác nhận entirely. A change from the Điểm đề xuất needs a reason.
 */

const w = scoringWorld({ gradingMode: "advisory_based", minGraders: 2 });
const leader = () => w.A.advisors[0]!;
const m = (i: number) => w.A.members[i]!;

/** A hồ sơ with phiên bản 1 issued, Phân công to thành viên 0 to 2 (or `members`). */
const issued = (members = [m(0), m(1), m(2)], points?: Record<string, number>) =>
  w.f.advisoryIssued(w.ward, w.province, w.setId, w.A.secretary, { members, advisors: [leader()] }, { points });

type Pick = { dossierId: string; version: number; advisoryVersionId?: string };
const copy = (actor: UserActor, picks: Pick[], criteria: "all" | string[] = "all", recipients: "all" | string[] = "all") =>
  w.t.app.scoring.copyAdvisory(actor, {
    dossiers: picks.map((p) => ({ dossierId: p.dossierId, expectedVersion: p.version, advisoryVersionId: p.advisoryVersionId })),
    criteria,
    recipients,
  });
const preview = (actor: UserActor, picks: Pick[], criteria: "all" | string[] = "all", recipients: "all" | string[] = "all") =>
  w.t.app.scoring.previewAdvisoryCopy(actor, {
    dossiers: picks.map((p) => ({ dossierId: p.dossierId, advisoryVersionId: p.advisoryVersionId })),
    criteria,
    recipients,
  });
const sheetOf = async (member: UserActor, dossierId: string) => {
  const view = await w.t.app.scoring.readDossierScores(member, { dossierId, ownSheet: true });
  if (view.kind !== "own_sheet") throw new Error(`no own sheet: ${view.kind}`);
  return view;
};
const byCode = (view: Awaited<ReturnType<typeof sheetOf>>) => Object.fromEntries(view.criteria.map((c) => [c.code, c]));

describe("L12 TM-08 the first sao chép (stories 65, 71, 74, 81)", () => {
  it("fills every thành viên chấm's Phiếu chấm from phiên bản 1 and moves the hồ sơ to Thành viên xem xét", async () => {
    const d = await issued();
    await expect(
      w.t.app.scoring.saveScoreSheet(m(0), {
        dossierId: d.dossierId,
        expectedVersion: 1,
        lines: [{ criterionId: w.criterionId("2.1"), levelId: w.level("2.1:25"), comment: "", evidenceFileIds: [] }],
      }),
    ).rejects.toMatchObject({ code: "invalid_state" });

    const result = await copy(leader(), [d]);

    expect(result.dossiers).toEqual([
      expect.objectContaining({
        dossierId: d.dossierId,
        version: d.version + 1,
        state: "member_review",
        advisoryVersion: { id: expect.any(String), number: 1 },
        written: 9,
        skipped: [],
      }),
    ]);
    const lines = byCode(await sheetOf(m(1), d.dossierId));
    expect(lines["1.1"]).toMatchObject({
      levelId: w.level("1.1:40"),
      points: 40,
      comment: "Căn cứ 1.1",
      source: "advisory",
      edited: false,
      advisory: { number: 1, levelId: w.level("1.1:40"), points: 40 },
    });
    expect(lines["3.1"]).toMatchObject({ levelId: w.level("3.1:35"), source: "advisory", advisory: { number: 1 } });
    expect((await w.t.app.dossiers.get(w.A.secretary, { dossierId: d.dossierId })).state).toBe("member_review");
  });
});

/** Phiên bản N+1 of the Tổ trưởng with these points by mã (others as the nháp holds them). */
async function reissue(d: { dossierId: string }, points: Record<string, number>, reason = "Xem lại điểm") {
  const ws = await w.t.app.scoring.advisoryReport(leader(), { dossierId: d.dossierId });
  const lines = ws.criteria.map((c) => ({
    criterionId: c.criterionId,
    levelId: points[c.code] === undefined ? c.line.levelId : c.levels.find((l) => l.points === points[c.code])!.id,
    basis: points[c.code] === undefined ? c.line.basis : `Căn cứ mới ${c.code}`,
    evidenceFileIds: [],
    evidenceAssessment: c.line.evidenceAssessment,
  }));
  const r = await w.t.app.scoring.reissueAdvisoryReport(leader(), {
    dossierId: d.dossierId,
    expectedVersion: ws.dossierVersion,
    reason,
    lines,
    summary: ws.summary,
    notes: ws.notes,
    attachmentFileIds: [],
  });
  return { dossierId: d.dossierId, version: r.version };
}
const save = (member: UserActor, dossierId: string, expectedVersion: number, lines: { code: string; points: number; adjustReason?: string }[]) =>
  w.t.app.scoring.saveScoreSheet(member, {
    dossierId,
    expectedVersion,
    lines: lines.map((l) => ({
      criterionId: w.criterionId(l.code),
      levelId: w.level(`${l.code}:${l.points}`),
      comment: "",
      evidenceFileIds: [],
      adjustReason: l.adjustReason,
    })),
  });
const dossierVersion = async (dossierId: string) => (await w.t.app.dossiers.get(w.A.secretary, { dossierId })).version;

describe("L12 TM-09 xem trước (story 69)", () => {
  it("writes nothing and plans exactly what the sao chép then does", async () => {
    const d = await issued([m(0), m(1)]);
    const plan = await preview(leader(), [d], ["1.1", "3.1"], [m(1).userId]);

    expect(plan.dossiers).toEqual([
      {
        dossierId: d.dossierId,
        code: expect.stringMatching(/^HS-/),
        productName: expect.any(String),
        advisoryVersion: { id: expect.any(String), number: 1 },
        criteria: ["1.1", "3.1"],
        recipients: [{ userId: m(1).userId, fullName: m(1).fullName, sheet: "new", written: ["1.1", "3.1"], edited: [] }],
        written: 2,
        skipped: [],
      },
    ]);
    expect(await dossierVersion(d.dossierId)).toBe(d.version);
    expect((await sheetOf(m(1), d.dossierId)).criteria.every((c) => c.levelId === null)).toBe(true);

    const [done] = (await copy(leader(), [d], ["1.1", "3.1"], [m(1).userId])).dossiers;
    const { version: _v, state: _s, ...result } = done!;
    expect(result).toEqual(plan.dossiers[0]);
  });
});

describe("L12 TM-08 phạm vi, người nhận, nhiều hồ sơ (stories 66 to 68, 70)", () => {
  it("copies only the Tiêu chí and thành viên chosen; the others stay blank and the hồ sơ still opens", async () => {
    const d = await issued([m(0), m(1)]);
    await copy(leader(), [d], ["2.1"], [m(0).userId]);

    const mine = byCode(await sheetOf(m(0), d.dossierId));
    expect([mine["1.1"]!.levelId, mine["2.1"]!.levelId, mine["3.1"]!.levelId]).toEqual([null, w.level("2.1:25"), null]);
    expect((await sheetOf(m(1), d.dossierId)).criteria.every((c) => c.levelId === null)).toBe(true);
    // A thành viên left out may still score by hand now that grading is open.
    await expect(save(m(1), d.dossierId, 1, [{ code: "1.1", points: 20 }])).resolves.toEqual({ version: 2 });
  });

  it("copies several hồ sơ at once, each from its newest issued phiên bản unless one is named", async () => {
    const d1 = await issued([m(0), m(1)]);
    const d2 = await issued([m(2), m(3)]);
    const r2 = await reissue(d2, { "1.1": 20 });
    const versions = await w.t.app.scoring.advisoryReportVersions(leader(), { dossierId: d2.dossierId });

    const { dossiers } = await copy(leader(), [d1, r2]);
    expect(dossiers.map((x) => [x.dossierId, x.advisoryVersion.number, x.written, x.state])).toEqual([
      [d1.dossierId, 1, 6, "member_review"],
      [d2.dossierId, 2, 6, "member_review"],
    ]);
    expect(byCode(await sheetOf(m(2), d2.dossierId))["1.1"]).toMatchObject({ levelId: w.level("1.1:20"), advisory: { number: 2 } });

    // Phiên bản 1 named explicitly writes its Mức điểm back over the dòng nobody edited.
    const [again] = (await copy(leader(), [{ dossierId: d2.dossierId, version: await dossierVersion(d2.dossierId), advisoryVersionId: versions[0]!.id }]))
      .dossiers;
    expect(again).toMatchObject({ advisoryVersion: { number: 1 }, state: "member_review" });
    expect(byCode(await sheetOf(m(3), d2.dossierId))["1.1"]).toMatchObject({ levelId: w.level("1.1:40"), advisory: { number: 1 } });
  });

  it("rolls the whole lô back when one hồ sơ changed meanwhile, and names it", async () => {
    const d1 = await issued([m(0), m(1)]);
    const d2 = await issued([m(0), m(1)]);
    const stale = { ...d2, version: d2.version - 1 };

    const err = await copy(leader(), [d1, stale]).catch((e: unknown) => e);
    const code = (await w.t.app.dossiers.get(w.A.secretary, { dossierId: d2.dossierId })).code;
    expect(err).toMatchObject({ code: "version_conflict", dossierId: d2.dossierId, message: expect.stringContaining(code) });
    expect((await w.t.app.dossiers.get(w.A.secretary, { dossierId: d1.dossierId })).state).toBe("advisory_report_issued");
    expect((await sheetOf(m(0), d1.dossierId)).criteria.every((c) => c.levelId === null)).toBe(true);
  });

  it("refuses an empty lô, phạm vi or người nhận, a mã outside the Bộ tiêu chí, and a người nhận not Phân công", async () => {
    const d = await issued([m(0), m(1)]);
    await expect(copy(leader(), [])).rejects.toMatchObject({ code: "dossiers_required" });
    await expect(copy(leader(), [d], [])).rejects.toMatchObject({ code: "criteria_required" });
    await expect(copy(leader(), [d], "all", [])).rejects.toMatchObject({ code: "recipients_required" });
    await expect(copy(leader(), [d], ["9.9"])).rejects.toMatchObject({ code: "criterion_not_in_set", dossierId: d.dossierId });
    await expect(copy(leader(), [d], "all", [m(3).userId])).rejects.toMatchObject({ code: "recipient_not_assigned" });
    await expect(copy(leader(), [{ ...d, advisoryVersionId: "01900000-0000-7000-8000-000000000000" }])).rejects.toMatchObject({
      code: "advisory_version_not_found",
    });
  });
});

describe("L12 sao chép lại, Tiêu chí by Tiêu chí (stories 72, 73)", () => {
  it("updates the dòng nobody edited, keeps and reports the edited ones, and leaves a Phiếu chấm đã xác nhận whole", async () => {
    const d = await issued([m(0), m(1), m(2)]);
    await copy(leader(), [d]);
    // m(0) edits 1.1; m(1) xác nhận the copied phiếu as it is; m(2) touches nothing.
    await save(m(0), d.dossierId, (await sheetOf(m(0), d.dossierId)).sheet!.version, [{ code: "1.1", points: 20, adjustReason: "Thiếu hồ sơ tập huấn" }]);
    await w.t.app.scoring.confirmScoreSheet(m(1), { dossierId: d.dossierId, expectedVersion: (await sheetOf(m(1), d.dossierId)).sheet!.version });
    const v2 = await reissue(d, { "1.1": 0, "2.1": 0 });

    const planned = await preview(leader(), [v2]);
    const [done] = (await copy(leader(), [v2])).dossiers;

    expect(done).toMatchObject({ advisoryVersion: { number: 2 }, state: "member_review", written: 5 });
    expect(done!.recipients.map((r) => [r.userId, r.sheet, r.written, r.edited])).toEqual(
      expect.arrayContaining([
        [m(0).userId, "update", ["2.1", "3.1"], ["1.1"]],
        [m(1).userId, "confirmed", [], []],
        [m(2).userId, "update", ["1.1", "2.1", "3.1"], []],
      ]),
    );
    expect(done!.skipped).toEqual(
      expect.arrayContaining([
        { userId: m(0).userId, fullName: m(0).fullName, criterion: "1.1", reason: "edited" },
        { userId: m(1).userId, fullName: m(1).fullName, criterion: null, reason: "confirmed" },
      ]),
    );
    expect(done!.skipped).toHaveLength(2);
    const { version: _v, state: _s, ...result } = done!;
    expect(result).toEqual(planned.dossiers[0]);

    const edited = byCode(await sheetOf(m(0), d.dossierId));
    expect(edited["1.1"]).toMatchObject({
      levelId: w.level("1.1:20"),
      edited: true,
      adjustReason: "Thiếu hồ sơ tập huấn",
      advisory: { number: 1, points: 40 },
    });
    expect(edited["2.1"]).toMatchObject({ levelId: w.level("2.1:0"), edited: false, comment: "Căn cứ mới 2.1", advisory: { number: 2, points: 0 } });
    const confirmed = byCode(await sheetOf(m(1), d.dossierId));
    expect([confirmed["1.1"]!.points, confirmed["2.1"]!.points]).toEqual([40, 25]);
    expect(byCode(await sheetOf(m(2), d.dossierId))["1.1"]).toMatchObject({ points: 0, advisory: { number: 2 } });
  });

  it("copies again while Sẵn sàng chốt, into the phiếu not yet xác nhận", async () => {
    const d = await issued([m(0), m(1), m(2)]);
    await copy(leader(), [d]);
    for (const member of [m(0), m(1)]) {
      await w.t.app.scoring.confirmScoreSheet(member, { dossierId: d.dossierId, expectedVersion: (await sheetOf(member, d.dossierId)).sheet!.version });
    }
    expect((await w.t.app.dossiers.get(w.A.secretary, { dossierId: d.dossierId })).state).toBe("member_confirmed");
    const v2 = await reissue(d, { "3.1": 0 });

    const [done] = (await copy(leader(), [v2])).dossiers;
    expect(done).toMatchObject({ state: "member_confirmed", written: 3 });
    expect(byCode(await sheetOf(m(2), d.dossierId))["3.1"]).toMatchObject({ points: 0, advisory: { number: 2 } });
  });
});

describe("TV-04 điều chỉnh khác Điểm đề xuất cần lý do (stories 84, 85)", () => {
  it("refuses a dòng from the Tổ tư vấn moved off the Mức điểm gốc without a reason, on save", async () => {
    const d = await issued([m(0), m(1)]);
    await copy(leader(), [d]);
    const version = (await sheetOf(m(0), d.dossierId)).sheet!.version;

    await expect(save(m(0), d.dossierId, version, [{ code: "1.1", points: 20 }])).rejects.toMatchObject({ code: "adjust_reason_required" });
    await expect(save(m(0), d.dossierId, version, [{ code: "1.1", points: 20, adjustReason: "  " }])).rejects.toMatchObject({ code: "adjust_reason_required" });
    // Back on the Mức điểm gốc, no reason is needed and none is kept.
    const kept = await save(m(0), d.dossierId, version, [{ code: "1.1", points: 40, adjustReason: "Không cần" }]);
    expect(byCode(await sheetOf(m(0), d.dossierId))["1.1"]).toMatchObject({ points: 40, edited: true, adjustReason: null, source: "advisory" });
    await save(m(0), d.dossierId, kept.version, [{ code: "1.1", points: 20, adjustReason: "Chưa có chứng nhận" }]);
    expect(byCode(await sheetOf(m(0), d.dossierId))["1.1"]).toMatchObject({ points: 20, adjustReason: "Chưa có chứng nhận", advisory: { points: 40 } });
  });
});

describe("L09 a thành viên chấm added after the first sao chép waits for the next one (spec #49 HD-03)", () => {
  it("refuses lưu and xác nhận on the Phiếu chấm trống until a sao chép writes into it, and says it is waiting", async () => {
    const d = await issued([m(0), m(1)]);
    await copy(leader(), [d]);
    await w.t.app.councils.addAssignment(w.A.secretary, {
      dossierId: d.dossierId,
      expectedVersion: await dossierVersion(d.dossierId),
      userId: m(3).userId,
      kind: "member",
      reason: "Bổ sung thành viên",
    });

    const waiting = await sheetOf(m(3), d.dossierId);
    expect(waiting.sheet).toMatchObject({ state: "draft", awaitingCopy: true });
    await expect(save(m(3), d.dossierId, waiting.sheet!.version, [{ code: "1.1", points: 40 }])).rejects.toMatchObject({ code: "score_sheet_awaiting_copy" });
    await expect(w.t.app.scoring.confirmScoreSheet(m(3), { dossierId: d.dossierId, expectedVersion: waiting.sheet!.version })).rejects.toMatchObject({
      code: "score_sheet_awaiting_copy",
    });
    // The others are not held up.
    expect((await sheetOf(m(0), d.dossierId)).sheet).toMatchObject({ awaitingCopy: false });

    await copy(leader(), [{ dossierId: d.dossierId, version: await dossierVersion(d.dossierId) }], "all", [m(3).userId]);

    const filled = await sheetOf(m(3), d.dossierId);
    expect(filled.sheet).toMatchObject({ awaitingCopy: false });
    expect(byCode(filled)["1.1"]).toMatchObject({ source: "advisory", levelId: w.level("1.1:40") });
    await expect(save(m(3), d.dossierId, filled.sheet!.version, [{ code: "1.1", points: 40 }])).resolves.toMatchObject({ version: filled.sheet!.version + 1 });
  });
});

describe("L12 audit, outbox and thông báo (stories 75, 76)", () => {
  it("writes one audit row per hồ sơ with phiên bản, phạm vi, người nhận and result, and tells only those with a dòng written", async () => {
    const d = await issued([m(0), m(1)]);
    await copy(leader(), [d], ["1.1"], [m(0).userId]);

    const rows = await w.t.app.audit.search(await w.f.admin(), { action: ["dossier.advisory_copy"], targetId: d.dossierId });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorUserId: leader().userId,
      before: { state: "advisory_report_issued" },
      after: { state: "member_review" },
      metadata: { advisoryVersionNumber: 1, criteria: ["1.1"], recipients: [{ userId: m(0).userId, sheet: "new", written: ["1.1"], edited: [] }], written: 1 },
    });
    const outbox = await w.db.admin.query("SELECT payload FROM platform.outbox WHERE type = 'dossier.advisory_copied' AND payload->>'dossierId' = $1", [
      d.dossierId,
    ]);
    expect(outbox.rows).toEqual([
      { payload: expect.objectContaining({ from: "advisory_report_issued", to: "member_review", recipientUserIds: [m(0).userId] }) },
    ]);
    const timeline = await w.t.app.dossiers.timeline(d.a, { dossierId: d.dossierId });
    expect(timeline.map((e) => e.action)).not.toContain("dossier.advisory_copy");

    await w.t.drainJobs();
    const link = `/thanh-vien/ho-so/${d.dossierId}`;
    expect((await w.t.app.notifications.list(m(0))).filter((n) => n.kind === "dossier_advisory_copied" && n.link === link)).toHaveLength(1);
    expect(w.t.mailbox.to(m(0).email).some((e) => e.text.includes(link))).toBe(true);
    expect((await w.t.app.notifications.list(m(1))).filter((n) => n.kind === "dossier_advisory_copied" && n.link === link)).toEqual([]);
  });
});

describe("L12 who may copy, and when (stories 64, 81)", () => {
  it("is refused before phiên bản 1, to a thành viên chấm, and to a Tổ tư vấn not Phân công", async () => {
    const before = await w.f.gradingStarted(w.ward, w.province, w.setId, w.A.secretary, { members: [m(0), m(1)], advisors: [leader()] });
    await expect(copy(leader(), [before])).rejects.toMatchObject({ code: "invalid_state" });
    await expect(preview(leader(), [before])).rejects.toMatchObject({ code: "invalid_state" });
    const d = await issued([m(0), m(1)]);
    await expect(copy(m(0), [d])).rejects.toMatchObject({ code: "forbidden" });
    await expect(copy(w.B.advisors[0]!, [d])).rejects.toMatchObject({ code: "not_found", dossierId: d.dossierId });
    expect((await w.t.app.scoring.advisoryCopyBoard(leader())).map((r) => r.dossierId)).toContain(d.dossierId);
  });
});

describe("L12 đợt chấm trực tiếp has no sao chép (story 77)", () => {
  const direct = scoringWorld({ gradingMode: "direct", minGraders: 2 });

  it("refuses with not_advisory_mode even a Tổ tư vấn whose Phân công is in force on the hồ sơ", async () => {
    const { t, f, A } = direct;
    const advisor = A.advisors[0]!;
    const s = await f.provinceReceived(direct.ward, direct.province, direct.setId);
    const [drafted] = (
      await t.app.councils.editAssignments(A.secretary, {
        dossiers: [{ dossierId: s.dossierId, expectedVersion: s.version }],
        members: [A.members[0]!.userId, A.members[1]!.userId],
        advisors: [advisor.userId],
      })
    ).dossiers;
    // No use case puts a Tổ tư vấn in force in chấm trực tiếp today (Giao chấm refuses it); the rule must hold if one ever does.
    await direct.db.admin.query("UPDATE council.assignment SET effective_at = now() WHERE dossier_id = $1 AND kind = 'advisory'", [s.dossierId]);
    const [started] = (await t.app.councils.startGrading(A.secretary, { dossiers: [{ dossierId: s.dossierId, expectedVersion: drafted!.version }] })).dossiers;
    expect(started!.state).toBe("member_review");

    const input = { dossiers: [{ dossierId: s.dossierId, expectedVersion: started!.version }], criteria: "all" as const, recipients: "all" as const };
    await expect(t.app.scoring.copyAdvisory(advisor, input)).rejects.toMatchObject({ code: "not_advisory_mode" });
    await expect(t.app.scoring.previewAdvisoryCopy(advisor, input)).rejects.toMatchObject({ code: "not_advisory_mode" });
    expect(await t.app.scoring.advisoryCopyBoard(advisor)).toEqual([]);
  });
});
