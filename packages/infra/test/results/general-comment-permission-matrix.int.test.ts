import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { scoringWorld } from "../scoring/world";

/*
 * #14 permission matrix rows for the Nhận xét chung and the Sở's view of the kết quả (#80, L16 CT-13, HD-10; spec #79
 * stories 1 to 6, 68). Each hồ sơ is Giao chấm (chấm trực tiếp) to thành viên M0 and M1 of Hội đồng A, both confirmed;
 * "Đã chốt điểm" is that hồ sơ chốt by the Thư ký A; "Đã công bố" is it with Công bố kết quả set (as #83 will).
 */

type Who = "Chủ tịch A" | "Thư ký A" | "Thành viên A, chấm" | "Tổ tư vấn A" | "Chủ tịch B" | "Thư ký B" | "Cán bộ Sở" | "Cán bộ xã" | "Chủ thể" | "Quản trị";
type State = "Sẵn sàng chốt" | "Đã chốt điểm" | "Đã công bố";
type Action = "viết Nhận xét chung" | "xem điểm";
type Outcome = "allowed" | "not_found" | "forbidden" | "invalid_state" | "result_published" | "full" | "aggregate_only" | "none";

const ROWS: [Who, Action, State, Outcome][] = [
  // Stories 1, 2: the Chủ tịch and Thư ký of the Hội đồng, from chốt điểm.
  ["Chủ tịch A", "viết Nhận xét chung", "Đã chốt điểm", "allowed"],
  ["Thư ký A", "viết Nhận xét chung", "Đã chốt điểm", "allowed"],
  // Story 4: not before chốt; story 3: not after Công bố kết quả.
  ["Thư ký A", "viết Nhận xét chung", "Sẵn sàng chốt", "invalid_state"],
  ["Chủ tịch A", "viết Nhận xét chung", "Đã công bố", "result_published"],
  ["Thư ký A", "viết Nhận xét chung", "Đã công bố", "result_published"],
  // Another Hội đồng does not see the hồ sơ at all.
  ["Chủ tịch B", "viết Nhận xét chung", "Đã chốt điểm", "not_found"],
  ["Thư ký B", "viết Nhận xét chung", "Đã chốt điểm", "not_found"],
  // Stories 5, 6: nobody else writes it.
  ["Thành viên A, chấm", "viết Nhận xét chung", "Đã chốt điểm", "forbidden"],
  ["Tổ tư vấn A", "viết Nhận xét chung", "Đã chốt điểm", "forbidden"],
  ["Cán bộ Sở", "viết Nhận xét chung", "Đã chốt điểm", "forbidden"],
  ["Cán bộ xã", "viết Nhận xét chung", "Đã chốt điểm", "forbidden"],
  ["Chủ thể", "viết Nhận xét chung", "Đã chốt điểm", "forbidden"],
  ["Quản trị", "viết Nhận xét chung", "Đã chốt điểm", "forbidden"],
  // Story 68: the Sở sees the kết quả chốt, never a thành viên's phiếu; nothing before chốt. The xã never.
  ["Cán bộ Sở", "xem điểm", "Sẵn sàng chốt", "none"],
  ["Cán bộ Sở", "xem điểm", "Đã chốt điểm", "aggregate_only"],
  ["Cán bộ Sở", "xem điểm", "Đã công bố", "aggregate_only"],
  ["Cán bộ xã", "xem điểm", "Đã chốt điểm", "none"],
  ["Cán bộ xã", "xem điểm", "Đã công bố", "none"],
  ["Quản trị", "xem điểm", "Đã chốt điểm", "none"],
];

describe("Permission matrix: Nhận xét chung and the Sở's view of the kết quả (#80)", () => {
  const w = scoringWorld({ minGraders: 2 });
  const actors = {} as Record<Exclude<Who, "Chủ thể">, UserActor>;
  beforeAll(async () => {
    Object.assign(actors, {
      "Chủ tịch A": w.A.chair,
      "Thư ký A": w.A.secretary,
      "Thành viên A, chấm": w.A.members[0]!,
      "Tổ tư vấn A": w.A.advisors[0]!,
      "Chủ tịch B": w.B.chair,
      "Thư ký B": w.B.secretary,
      "Cán bộ Sở": w.province,
      "Cán bộ xã": w.ward,
      "Quản trị": await w.f.admin(),
    });
  });

  const confirmAll = async (actor: UserActor, dossierId: string) => {
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
  };
  const versionOf = async (dossierId: string) => (await w.t.app.dossiers.get(w.A.secretary, { dossierId })).version;

  async function dossierIn(state: State) {
    const d = await w.graded([w.A.members[0]!, w.A.members[1]!]);
    await confirmAll(w.A.members[0]!, d.dossierId);
    await confirmAll(w.A.members[1]!, d.dossierId);
    if (state === "Sẵn sàng chốt") return d;
    await w.t.app.scoring.createMeeting(w.A.secretary, {
      roundId: w.roundId,
      title: "Phiên họp",
      heldOn: "2026-10-25",
      location: "Sở",
      dossierIds: [d.dossierId],
    });
    await w.t.app.scoring.finalize(w.A.secretary, { dossierId: d.dossierId, expectedVersion: await versionOf(d.dossierId) });
    if (state === "Đã công bố") {
      await w.db.admin.query("UPDATE dossier.dossier SET result_published_at = now(), version = version + 1 WHERE id = $1", [d.dossierId]);
    }
    return d;
  }

  async function attempt(who: Who, action: Action, d: { a: UserActor; dossierId: string }): Promise<Outcome> {
    const actor = who === "Chủ thể" ? d.a : actors[who];
    const { dossierId } = d;
    switch (action) {
      case "xem điểm":
        return (await w.t.app.scoring.readDossierScores(actor, { dossierId })).kind as Outcome;
      case "viết Nhận xét chung":
        await w.t.app.results.editGeneralComment(actor, { dossierId, expectedVersion: await versionOf(dossierId), text: "Nhận xét chung" });
        return "allowed";
    }
  }

  it.each(ROWS)("%s / %s / %s → %s", async (who, action, state, outcome) => {
    const d = await dossierIn(state);
    const run = attempt(who, action, d);
    if (["allowed", "full", "aggregate_only", "none"].includes(outcome)) await expect(run).resolves.toBe(outcome);
    else await expect(run).rejects.toMatchObject({ code: outcome });
  });

  it("never gives the Sở a thành viên's phiếu or name", async () => {
    const d = await dossierIn("Đã chốt điểm");
    const text = JSON.stringify(await w.t.app.scoring.readDossierScores(w.province, { dossierId: d.dossierId }));
    for (const x of [w.A.members[0]!, w.A.members[1]!]) {
      expect(text).not.toContain(x.fullName);
      expect(text).not.toContain(x.userId);
    }
  });
});
