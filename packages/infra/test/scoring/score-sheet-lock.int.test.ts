import { describe, expect, it } from "vitest";
import { scoringWorld } from "./world";

/*
 * Khóa ba lớp of the Phiếu chấm (#54, spec #49 story 91, 135; ADR 0008): the database itself refuses, to the
 * application's own user and to the owner, any change to a phiếu no longer draft (but confirmed → superseded
 * on the state columns alone) and any write to its dòng; the application's user cannot switch the triggers off.
 */
describe("Phiếu chấm triggers (#54, story 91, 135)", () => {
  const w = scoringWorld();

  /** A hồ sơ Giao chấm to two thành viên; returns the id of the first one's Phiếu chấm trống. */
  async function draftSheet() {
    const d = await w.graded([w.A.members[0]!, w.A.members[1]!]);
    const { rows } = await w.db.admin.query(
      `SELECT s.id FROM scoring.score_sheet s JOIN council.assignment a ON a.id = s.assignment_id WHERE s.dossier_id = $1 AND a.user_id = $2`,
      [d.dossierId, w.A.members[0]!.userId],
    );
    return rows[0]!.id as string;
  }
  const insertLine = (sheetId: string, code = "1.1", points = 20) =>
    w.db.app.query(`INSERT INTO scoring.score_sheet_line (score_sheet_id, criterion_id, score_level_id, updated_at) VALUES ($1, $2, $3, now())`, [
      sheetId,
      w.criterionId(code),
      w.level(`${code}:${points}`),
    ]);
  const confirm = (sheetId: string) =>
    w.db.app.query(
      `UPDATE scoring.score_sheet SET state = 'confirmed', confirmed_at = now(), reauth_method = 'password', version = version + 1 WHERE id = $1`,
      [sheetId],
    );

  it("lets the application write a draft phiếu and its dòng", async () => {
    const sheetId = await draftSheet();
    await insertLine(sheetId);
    await w.db.app.query(`UPDATE scoring.score_sheet_line SET comment = 'ổn' WHERE score_sheet_id = $1`, [sheetId]);
    await w.db.app.query(`UPDATE scoring.score_sheet SET version = version + 1 WHERE id = $1`, [sheetId]);
    await expect(confirm(sheetId)).resolves.toBeDefined();
  });

  it("refuses any UPDATE of a confirmed phiếu, even by the owner, but the move to superseded on the state columns", async () => {
    const sheetId = await draftSheet();
    await confirm(sheetId);

    for (const sql of [
      `UPDATE scoring.score_sheet SET state = 'draft' WHERE id = $1`,
      `UPDATE scoring.score_sheet SET confirmed_at = now() - interval '1 day' WHERE id = $1`,
      `UPDATE scoring.score_sheet SET version = version + 1 WHERE id = $1`,
      `UPDATE scoring.score_sheet SET state = 'absent' WHERE id = $1`,
      `UPDATE scoring.score_sheet SET state = 'superseded', version = version + 1 WHERE id = $1`,
    ]) {
      await expect(w.db.app.query(sql, [sheetId])).rejects.toThrow(/immutable/);
      await expect(w.db.admin.query(sql, [sheetId])).rejects.toThrow(/immutable/);
    }
    await expect(
      w.db.app.query(`UPDATE scoring.score_sheet SET state = 'superseded', superseded_reason = 'Trả phiếu' WHERE id = $1`, [sheetId]),
    ).resolves.toBeDefined();
    // Superseded is final.
    await expect(w.db.admin.query(`UPDATE scoring.score_sheet SET superseded_reason = 'khác' WHERE id = $1`, [sheetId])).rejects.toThrow(/immutable/);
  });

  it("lets a phiếu Vắng move to superseded on the state columns alone, and nothing else (#61)", async () => {
    const sheetId = await draftSheet();
    await w.db.app.query(`UPDATE scoring.score_sheet SET state = 'absent' WHERE id = $1`, [sheetId]);

    await expect(w.db.admin.query(`UPDATE scoring.score_sheet SET state = 'draft' WHERE id = $1`, [sheetId])).rejects.toThrow(/immutable/);
    await expect(w.db.app.query(`UPDATE scoring.score_sheet SET state = 'superseded', version = version + 1 WHERE id = $1`, [sheetId])).rejects.toThrow(
      /immutable/,
    );
    await expect(
      w.db.app.query(`UPDATE scoring.score_sheet SET state = 'superseded', superseded_reason = 'Trả phiếu' WHERE id = $1`, [sheetId]),
    ).resolves.toBeDefined();
    await expect(w.db.admin.query(`UPDATE scoring.score_sheet SET state = 'draft' WHERE id = $1`, [sheetId])).rejects.toThrow(/immutable/);
  });

  it("checks superseded_by at commit, so Trả phiếu may name the lần chấm it inserts next (#61)", async () => {
    const sheetId = await draftSheet();
    await confirm(sheetId);
    const client = await w.db.app.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE scoring.score_sheet SET state = 'superseded', superseded_by = gen_random_uuid() WHERE id = $1`, [sheetId]);
      await expect(client.query("COMMIT")).rejects.toThrow(/foreign key/);
    } finally {
      client.release();
    }
  });

  it("refuses writing the dòng of a phiếu no longer draft", async () => {
    const sheetId = await draftSheet();
    await insertLine(sheetId);
    await confirm(sheetId);

    await expect(insertLine(sheetId, "2.1", 25)).rejects.toThrow(/immutable/);
    await expect(
      w.db.app.query(`UPDATE scoring.score_sheet_line SET score_level_id = $2 WHERE score_sheet_id = $1`, [sheetId, w.level("1.1:40")]),
    ).rejects.toThrow(/immutable/);
    await expect(w.db.admin.query(`DELETE FROM scoring.score_sheet_line WHERE score_sheet_id = $1`, [sheetId])).rejects.toThrow(/immutable/);
    await expect(w.db.app.query(`DELETE FROM scoring.score_sheet_line WHERE score_sheet_id = $1`, [sheetId])).rejects.toThrow(/permission denied/);
  });

  it("never deletes a phiếu, and the application cannot switch the triggers off", async () => {
    const sheetId = await draftSheet();
    await expect(w.db.app.query(`DELETE FROM scoring.score_sheet WHERE id = $1`, [sheetId])).rejects.toThrow(/permission denied/);
    await expect(w.db.admin.query(`DELETE FROM scoring.score_sheet WHERE id = $1`, [sheetId])).rejects.toThrow(/immutable/);
    await expect(w.db.app.query(`ALTER TABLE scoring.score_sheet DISABLE TRIGGER score_sheet_guard`)).rejects.toThrow(/must be owner/);
    await expect(w.db.app.query(`ALTER TABLE scoring.score_sheet_line DISABLE TRIGGER score_sheet_line_guard`)).rejects.toThrow(/must be owner/);
    await expect(w.db.app.query(`SET session_replication_role = replica`)).rejects.toThrow(/permission denied/);
  });
});
