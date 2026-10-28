import { describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { PASSWORD } from "../dossiers/fixtures";
import { scoringWorld } from "./world";

/*
 * L15 HD-04, TV-08 (#73, CODING_STANDARDS.md "Truy cập dữ liệu cá nhân"): the `full` score view shows each thành viên's
 * name with the points of their phiếu, a personal data access (NĐ 13/2023), so every reading writes one
 * `personal_data.viewed` with `view: "full"`. The views that show no other thành viên's points write nothing.
 */
describe("L15 Audit of the full score view (#73)", () => {
  const w = scoringWorld({ minGraders: 2 });
  const m = (i: number) => w.A.members[i]!;

  async function scoreAndConfirm(actor: UserActor, dossierId: string) {
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "own_sheet") throw new Error(`expected own_sheet, got ${view.kind}`);
    const lines = (
      [
        ["1.1", 40],
        ["2.1", 25],
        ["3.1", 35],
      ] as const
    ).map(([code, points]) => ({ criterionId: w.criterionId(code), levelId: w.level(`${code}:${points}`), comment: "", evidenceFileIds: [] }));
    const { version } = await w.t.app.scoring.saveScoreSheet(actor, { dossierId, expectedVersion: view.sheet!.version, lines });
    await w.t.app.scoring.confirmScoreSheet(actor, { dossierId, expectedVersion: version });
  }

  /** A hồ sơ Sẵn sàng chốt: thành viên 0 and 1 confirmed, 2 has a phiếu not yet confirmed. */
  async function ready() {
    const d = await w.graded([m(0), m(1), m(2)]);
    await scoreAndConfirm(m(0), d.dossierId);
    await scoreAndConfirm(m(1), d.dossierId);
    return d;
  }

  const viewed = async (dossierId: string) =>
    (await w.t.app.audit.search(await w.f.admin(), { action: ["personal_data.viewed"], targetId: dossierId })).map((v) => [
      v.actorUserId,
      v.targetType,
      v.metadata,
    ]);

  it("writes one personal_data.viewed per reading of the full view, by its reader, before chốt (story 93)", async () => {
    const d = await ready();

    for (const who of [w.A.chair, w.A.secretary, m(0), m(0)]) {
      expect((await w.t.app.scoring.readDossierScores(who, { dossierId: d.dossierId })).kind).toBe("full");
    }

    expect(await viewed(d.dossierId)).toEqual(
      expect.arrayContaining([
        [w.A.chair.userId, "dossier", { view: "full" }],
        [w.A.secretary.userId, "dossier", { view: "full" }],
      ]),
    );
    expect((await viewed(d.dossierId)).filter(([userId]) => userId === m(0).userId)).toEqual([
      [m(0).userId, "dossier", { view: "full" }],
      [m(0).userId, "dossier", { view: "full" }],
    ]);
    expect(await viewed(d.dossierId)).toHaveLength(4);
  });

  it("writes one for each reading of the kết quả chốt, a Vắng thành viên's too, and none for a phiếu of one's own or a reader outside the Hội đồng (story 122)", async () => {
    const d = await ready();
    expect((await w.t.app.scoring.readDossierScores(m(2), { dossierId: d.dossierId })).kind).toBe("own_sheet");
    expect((await w.t.app.scoring.readDossierScores(m(0), { dossierId: d.dossierId, ownSheet: true })).kind).toBe("own_sheet");
    const version = (await w.t.app.dossiers.get(w.A.secretary, { dossierId: d.dossierId })).version;
    await w.t.app.scoring.createMeeting(w.A.secretary, {
      roundId: w.roundId,
      title: "Phiên họp",
      heldOn: "2026-10-25",
      location: "Sở",
      dossierIds: [d.dossierId],
    });
    await w.t.app.scoring.finalize(w.A.secretary, { dossierId: d.dossierId, expectedVersion: version });

    for (const who of [d.a, w.ward, await w.f.admin()]) {
      expect(await w.t.app.scoring.readDossierScores(who, { dossierId: d.dossierId })).toEqual({ kind: "none" });
    }
    // L16 (#80): the Sở sees the kết quả without any phiếu or name, so it is no personal data access.
    expect((await w.t.app.scoring.readDossierScores(w.province, { dossierId: d.dossierId })).kind).toBe("aggregate_only");
    expect(await viewed(d.dossierId)).toEqual([]);

    // After chốt the S63 list shows the stored tổng hợp, still without an audit.
    const listed = (await w.t.app.scoring.aggregateSummaries(m(2))).find((r) => r.dossierId === d.dossierId);
    expect(listed).toMatchObject({ state: "score_finalized", total: 100, star: 5, flagged: false });
    expect(await viewed(d.dossierId)).toEqual([]);

    // m(2) is Vắng in the kết quả chốt and sees it all (TV-08), the same tổng hợp as the list.
    const view = await w.t.app.scoring.readDossierScores(m(2), { dossierId: d.dossierId });
    if (view.kind !== "full") throw new Error(`expected full, got ${view.kind}`);
    expect(view.aggregate).toMatchObject({ total: listed!.total, star: listed!.star, flagged: listed!.flagged });
    expect(await viewed(d.dossierId)).toEqual([[m(2).userId, "dossier", { view: "full" }]]);
  });

  it("lists S63 the tổng hợp of each hồ sơ the reader sees in full, without any thành viên's phiếu, so the list writes no audit (story 93)", async () => {
    const d = await ready();

    const rows = await w.t.app.scoring.aggregateSummaries(m(0));

    const row = rows.find((r) => r.dossierId === d.dossierId);
    expect(row).toMatchObject({ dossierId: d.dossierId, state: "member_confirmed", total: 100, star: 5, flagged: false });
    expect(JSON.stringify(rows)).not.toContain(m(1).userId);
    // m(2) has not confirmed: no hồ sơ to list.
    expect((await w.t.app.scoring.aggregateSummaries(m(2))).map((r) => r.dossierId)).not.toContain(d.dossierId);
    expect(await viewed(d.dossierId)).toEqual([]);
  });
});

describe("L15 No audit for a reader's own phiếu alone (#73)", () => {
  const w = scoringWorld({ minGraders: 1 });
  const m = (i: number) => w.A.members[i]!;

  it("writes nothing when the only phiếu đã xác nhận in the full view is the reader's own", async () => {
    const d = await w.graded([m(0), m(1)]);
    const view = await w.t.app.scoring.readDossierScores(m(0), { dossierId: d.dossierId });
    if (view.kind !== "own_sheet") throw new Error(view.kind);
    const lines = ["1.1:40", "2.1:25", "3.1:35"].map((key) => ({
      criterionId: w.criterionId(key.split(":")[0]!),
      levelId: w.level(key),
      comment: "",
      evidenceFileIds: [],
    }));
    const { version } = await w.t.app.scoring.saveScoreSheet(m(0), { dossierId: d.dossierId, expectedVersion: view.sheet!.version, lines });
    await w.t.app.scoring.confirmScoreSheet(m(0), { dossierId: d.dossierId, expectedVersion: version });

    // One phiếu đã xác nhận of a minimum of 1: Sẵn sàng chốt, and m(0) sees the full view with only their own points.
    expect((await w.t.app.scoring.readDossierScores(m(0), { dossierId: d.dossierId })).kind).toBe("full");
    expect(await w.t.app.audit.search(await w.f.admin(), { action: ["personal_data.viewed"], targetId: d.dossierId })).toEqual([]);

    // The Chủ tịch sees m(0)'s points: that is someone else's.
    await w.t.app.scoring.readDossierScores(w.A.chair, { dossierId: d.dossierId });
    expect((await w.t.app.audit.search(await w.f.admin(), { action: ["personal_data.viewed"], targetId: d.dossierId })).map((v) => v.actorUserId)).toEqual([
      w.A.chair.userId,
    ]);
  });
});

describe("L15 No audit for the Tổ tư vấn's kết quả chốt (#73, story 123)", () => {
  const w = scoringWorld({ gradingMode: "advisory_based", minGraders: 2 });
  const PICKS = ["1.1:20", "2.1:25", "3.1:35"];

  it("writes nothing when the Tổ tư vấn reads the kết quả chốt, which names no thành viên", async () => {
    const [m0, m1] = [w.A.members[0]!, w.A.members[1]!];
    const advisor = w.A.advisors[0]!;
    const d = await w.graded([m0, m1], [advisor]);
    await w.t.app.councils.setLeader(w.province, { councilId: w.A.councilId, userId: advisor.userId });
    const advisoryLines = PICKS.map((key) => ({
      criterionId: w.criterionId(key.split(":")[0]!),
      levelId: w.level(key),
      basis: "Căn cứ hồ sơ",
      evidenceFileIds: [],
      evidenceAssessment: "sufficient" as const,
    }));
    await w.t.app.scoring.saveAdvisoryDraft(advisor, {
      dossierId: d.dossierId,
      draftVersion: 0,
      lines: advisoryLines,
      summary: "Nhận xét",
      notes: "",
      attachmentFileIds: [],
    });
    const issued = await w.t.app.scoring.issueAdvisoryReport(advisor, {
      dossierId: d.dossierId,
      expectedVersion: (await w.t.app.scoring.advisoryReport(advisor, { dossierId: d.dossierId })).dossierVersion,
    });
    await w.t.app.scoring.copyAdvisory(advisor, {
      dossiers: [{ dossierId: d.dossierId, expectedVersion: issued.version }],
      criteria: "all",
      recipients: "all",
    });
    for (const m of [m0, m1]) {
      const view = await w.t.app.scoring.readDossierScores(m, { dossierId: d.dossierId });
      if (view.kind !== "own_sheet") throw new Error(view.kind);
      const lines = PICKS.map((key) => ({ criterionId: w.criterionId(key.split(":")[0]!), levelId: w.level(key), comment: "", evidenceFileIds: [] }));
      const { version } = await w.t.app.scoring.saveScoreSheet(m, { dossierId: d.dossierId, expectedVersion: view.sheet!.version, lines });
      await w.t.app.scoring.confirmScoreSheet(m, { dossierId: d.dossierId, expectedVersion: version });
    }
    await w.t.app.identity.reauthenticate(w.A.secretary, { password: PASSWORD });
    const version = (await w.t.app.dossiers.get(w.A.secretary, { dossierId: d.dossierId })).version;
    await w.t.app.scoring.createMeeting(w.A.secretary, {
      roundId: w.roundId,
      title: "Phiên họp",
      heldOn: "2026-10-25",
      location: "Sở",
      dossierIds: [d.dossierId],
    });
    await w.t.app.scoring.finalize(w.A.secretary, { dossierId: d.dossierId, expectedVersion: version });

    expect((await w.t.app.scoring.readDossierScores(advisor, { dossierId: d.dossierId })).kind).toBe("aggregate_only");
    expect(await w.t.app.audit.search(await w.f.admin(), { action: ["personal_data.viewed"], targetId: d.dossierId })).toEqual([]);
  });
});
