import { describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { scoringWorld } from "./world";

/*
 * Khóa ba lớp of the kết quả chốt (#60, spec #49 stories 119, 135; ADR 0008): the database refuses, to the
 * application's own user and to the owner, any UPDATE or DELETE of an aggregate_result, but setting superseded_at
 * (with superseded_by_unlock) from null, once; a hồ sơ chốt stays in its Phiên họp. The application's user cannot
 * switch the triggers off.
 */
describe("Kết quả chốt triggers (#60, stories 119, 135)", () => {
  const w = scoringWorld({ minGraders: 2 });

  async function confirmAll(actor: UserActor, dossierId: string) {
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "own_sheet") throw new Error(view.kind);
    const lines = ["1.1:40", "2.1:25", "3.1:35"].map((key) => ({
      criterionId: w.criterionId(key.split(":")[0]!),
      levelId: w.level(key),
      comment: "",
      evidenceFileIds: [],
    }));
    const { version } = await w.t.app.scoring.saveScoreSheet(actor, { dossierId, expectedVersion: view.sheet!.version, lines });
    await w.t.app.scoring.confirmScoreSheet(actor, { dossierId, expectedVersion: version });
  }

  /** A hồ sơ chốt in a Phiên họp; returns the ids of its kết quả chốt and Phiên họp. */
  async function finalized() {
    const d = await w.graded([w.A.members[0]!, w.A.members[1]!]);
    for (const m of [w.A.members[0]!, w.A.members[1]!]) await confirmAll(m, d.dossierId);
    const { meetingId } = await w.t.app.scoring.createMeeting(w.A.secretary, {
      roundId: w.roundId,
      title: "Họp",
      heldOn: "2026-10-25",
      location: "Sở",
      dossierIds: [d.dossierId],
    });
    const view = await w.t.app.scoring.readDossierScores(w.A.secretary, { dossierId: d.dossierId });
    if (view.kind !== "full") throw new Error(view.kind);
    const { resultId } = await w.t.app.scoring.finalize(w.A.secretary, { dossierId: d.dossierId, expectedVersion: view.dossierVersion });
    return { resultId, meetingId, dossierId: d.dossierId };
  }

  it("refuses any UPDATE of a kết quả chốt, even by the owner, but superseding it once", async () => {
    const { resultId } = await finalized();

    for (const sql of [
      `UPDATE scoring.aggregate_result SET star = 5 WHERE id = $1`,
      `UPDATE scoring.aggregate_result SET total = 100 WHERE id = $1`,
      `UPDATE scoring.aggregate_result SET snapshot = '{}' WHERE id = $1`,
      `UPDATE scoring.aggregate_result SET superseded_at = now(), sha256 = repeat('0', 64) WHERE id = $1`,
    ]) {
      await expect(w.db.admin.query(sql, [resultId])).rejects.toThrow(/immutable/);
    }
    // The application may only write the superseded columns at all.
    await expect(w.db.app.query(`UPDATE scoring.aggregate_result SET star = 5 WHERE id = $1`, [resultId])).rejects.toThrow(/permission denied/);
    await expect(w.db.app.query(`UPDATE scoring.aggregate_result SET superseded_at = now() WHERE id = $1`, [resultId])).resolves.toBeDefined();
    // Superseded is final.
    await expect(w.db.app.query(`UPDATE scoring.aggregate_result SET superseded_at = now() + interval '1 day' WHERE id = $1`, [resultId])).rejects.toThrow(
      /immutable/,
    );
    await expect(w.db.admin.query(`UPDATE scoring.aggregate_result SET superseded_at = NULL WHERE id = $1`, [resultId])).rejects.toThrow(/immutable/);
  });

  it("never deletes a kết quả chốt nor moves a hồ sơ chốt out of its Phiên họp", async () => {
    const { resultId, meetingId, dossierId } = await finalized();

    await expect(w.db.app.query(`DELETE FROM scoring.aggregate_result WHERE id = $1`, [resultId])).rejects.toThrow(/permission denied/);
    await expect(w.db.admin.query(`DELETE FROM scoring.aggregate_result WHERE id = $1`, [resultId])).rejects.toThrow(/immutable/);
    await expect(w.db.admin.query(`TRUNCATE scoring.aggregate_result CASCADE`)).rejects.toThrow(/immutable/);
    await expect(w.db.app.query(`DELETE FROM scoring.meeting_dossier WHERE meeting_id = $1 AND dossier_id = $2`, [meetingId, dossierId])).rejects.toThrow(
      /fixed/,
    );
    await expect(w.db.app.query(`UPDATE scoring.meeting_dossier SET result_id = NULL WHERE meeting_id = $1`, [meetingId])).rejects.toThrow(/fixed/);
  });

  it("keeps a Mở khóa sau chốt request as written, and a kết quả superseded by it final (#63, stories 127, 128)", async () => {
    const { resultId, dossierId } = await finalized();
    const admin = await w.f.admin();
    const requestFileId = await w.f.uploadPdf(admin, "unlock_request", "Công văn.pdf");
    const { unlockId } = await w.t.app.scoring.unlockFinalized(admin, { dossierId, requestFileId, requestedBy: "Chủ tịch Hội đồng A", reason: "Sai sót" });

    const { rows } = await w.db.app.query(`SELECT superseded_by_unlock FROM scoring.aggregate_result WHERE id = $1`, [resultId]);
    expect(rows[0].superseded_by_unlock).toBe(unlockId);
    for (const sql of [`UPDATE scoring.unlock_request SET reason = 'khác' WHERE id = $1`, `DELETE FROM scoring.unlock_request WHERE id = $1`]) {
      await expect(w.db.app.query(sql, [unlockId])).rejects.toThrow(/permission denied/);
      await expect(w.db.admin.query(sql, [unlockId])).rejects.toThrow(/immutable/);
    }
    await expect(w.db.admin.query(`TRUNCATE scoring.unlock_request CASCADE`)).rejects.toThrow(/immutable/);
    await expect(w.db.app.query(`UPDATE scoring.aggregate_result SET superseded_by_unlock = NULL WHERE id = $1`, [resultId])).rejects.toThrow(/immutable/);
    // A kết quả points only at a Mở khóa that exists.
    const second = await finalized();
    await expect(
      w.db.app.query(`UPDATE scoring.aggregate_result SET superseded_at = now(), superseded_by_unlock = gen_random_uuid() WHERE id = $1`, [second.resultId]),
    ).rejects.toThrow(/aggregate_result_superseded_by_unlock_fkey/);
    await expect(w.db.app.query(`ALTER TABLE scoring.unlock_request DISABLE TRIGGER unlock_request_immutable`)).rejects.toThrow(/must be owner/);
  });

  it("keeps one pending row per hồ sơ across Phiên họp, and the application cannot switch the triggers off", async () => {
    const d = await w.graded([w.A.members[0]!, w.A.members[1]!]);
    for (const m of [w.A.members[0]!, w.A.members[1]!]) await confirmAll(m, d.dossierId);
    const first = await w.t.app.scoring.createMeeting(w.A.secretary, {
      roundId: w.roundId,
      title: "Họp 1",
      heldOn: "2026-10-25",
      location: "Sở",
      dossierIds: [d.dossierId],
    });
    const second = await w.t.app.scoring.createMeeting(w.A.secretary, {
      roundId: w.roundId,
      title: "Họp 2",
      heldOn: "2026-10-26",
      location: "Sở",
      dossierIds: [],
    });
    await expect(
      w.db.app.query(`INSERT INTO scoring.meeting_dossier (meeting_id, dossier_id, added_by, added_at) VALUES ($1, $2, $3, now())`, [
        second.meetingId,
        d.dossierId,
        w.A.secretary.userId,
      ]),
    ).rejects.toThrow(/meeting_dossier_pending_key/);
    expect(first.meetingId).not.toBe(second.meetingId);

    await expect(w.db.app.query(`ALTER TABLE scoring.aggregate_result DISABLE TRIGGER aggregate_result_immutable`)).rejects.toThrow(/must be owner/);
    await expect(w.db.app.query(`ALTER TABLE scoring.meeting_dossier DISABLE TRIGGER meeting_dossier_guard`)).rejects.toThrow(/must be owner/);
    await expect(w.db.app.query(`SET session_replication_role = replica`)).rejects.toThrow(/permission denied/);
  });
});
