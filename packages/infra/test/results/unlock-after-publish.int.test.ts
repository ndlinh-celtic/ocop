import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { ADMIN } from "../dossiers/fixtures";
import { FIVE, resultsWorld, THREE, TWO } from "./results-world";

/*
 * L15 Mở khóa sau chốt after Công bố kết quả (#83, spec #79 story 20, ADR 0008): once a Quyết định công nhận names a hồ sơ,
 * Quản trị can no longer Mở khóa it, a hồ sơ 5 sao still Đã chốt điểm included; the kết quả chốt stays hiện hành.
 */
describe("L16 Mở khóa sau chốt is refused once the kết quả is Công bố (#83)", () => {
  const { w, closedMeeting, record } = resultsWorld();
  let admin: UserActor;
  beforeAll(async () => {
    admin = await w.f.admin();
  });

  const unlock = async (dossierId: string) => {
    await w.t.app.identity.reauthenticate(admin, { password: ADMIN.password });
    return w.t.app.scoring.unlockFinalized(admin, {
      dossierId,
      requestFileId: await w.f.uploadPdf(admin, "unlock_request", "Công văn đề nghị mở khóa.pdf"),
      requestedBy: "Chủ tịch Hội đồng A",
      reason: "Sai sót khi chấm",
    });
  };

  it("refuses it for a hồ sơ Công nhận 3/4 sao and for a hồ sơ 5 sao still Đã chốt điểm (story 20)", async () => {
    const { meetingId, dossiers } = await closedMeeting([THREE, FIVE]);
    await record(meetingId);

    for (const { dossierId } of dossiers) {
      await expect(unlock(dossierId)).rejects.toMatchObject({ code: dossierId === dossiers[0]!.dossierId ? "invalid_state" : "result_published" });
      const results = await w.db.admin.query("SELECT superseded_at FROM scoring.aggregate_result WHERE dossier_id = $1", [dossierId]);
      expect(results.rows).toEqual([{ superseded_at: null }]);
    }
    expect((await w.t.app.dossiers.get(w.province, { dossierId: dossiers[1]!.dossierId })).state).toBe("score_finalized");
  });

  it("refuses it for a hồ sơ with a Thư kết quả không đạt (#85, story 45)", async () => {
    const { dossiers } = await closedMeeting([TWO]);
    const { dossierId } = dossiers[0]!;
    const { version } = await w.t.app.dossiers.get(w.province, { dossierId });
    await w.t.app.results.issueResultLetter(w.province, { dossierId, expectedVersion: version, criterionIds: [], advice: "" });

    await expect(unlock(dossierId)).rejects.toMatchObject({ code: "invalid_state" });
    const results = await w.db.admin.query("SELECT superseded_at FROM scoring.aggregate_result WHERE dossier_id = $1", [dossierId]);
    expect(results.rows).toEqual([{ superseded_at: null }]);
  });

  it("still lets Quản trị Mở khóa a hồ sơ Đã chốt điểm before Công bố kết quả", async () => {
    const { dossiers } = await closedMeeting([FIVE]);

    await expect(unlock(dossiers[0]!.dossierId)).resolves.toMatchObject({ dossierState: "member_confirmed" });
  });
});
