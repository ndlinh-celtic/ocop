import { beforeAll, describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { scoringWorld } from "./world";

/*
 * #14 permission matrix rows for Mở khóa sau chốt (#63, L15; spec #49 stories 127 to 132). Each hồ sơ is Giao chấm
 * (chấm trực tiếp) to thành viên M0, M1 and M2 of Hội đồng A; the đợt needs 2 phiếu đã xác nhận. "Thành viên xem xét"
 * is M0 confirmed; "Sẵn sàng chốt" is M0 and M1 confirmed; "Đã chốt điểm" is that hồ sơ chốt by the Thư ký A, M2 Vắng;
 * "Đã Mở khóa" is that hồ sơ Mở khóa by Quản trị (back to Sẵn sàng chốt, kết quả 1 superseded). Quản trị has no
 * DataScope over hồ sơ: it Mở khóa, and does nothing else to a hồ sơ or its điểm (story 132).
 */

type Who = "Quản trị" | "Chủ tịch A" | "Thư ký A" | "Thành viên A, Vắng" | "Tổ tư vấn A" | "Thư ký B" | "Cán bộ Sở" | "Cán bộ xã" | "Chủ thể";
type State = "Thành viên xem xét" | "Sẵn sàng chốt" | "Đã chốt điểm" | "Đã Mở khóa";
type Action = "Mở khóa" | "tra cứu theo mã" | "Trả phiếu Vắng" | "chốt" | "xem điểm" | "xem hồ sơ" | "xem các kết quả chốt";
type Outcome = "allowed" | "not_found" | "forbidden" | "invalid_state" | "none" | "full";

const ROWS: [Who, Action, State, Outcome][] = [
  // Stories 127, 131: Quản trị alone, and only a hồ sơ Đã chốt điểm.
  ["Quản trị", "Mở khóa", "Đã chốt điểm", "allowed"],
  ["Quản trị", "Mở khóa", "Sẵn sàng chốt", "invalid_state"],
  ["Quản trị", "Mở khóa", "Thành viên xem xét", "invalid_state"],
  ["Quản trị", "Mở khóa", "Đã Mở khóa", "invalid_state"],
  ["Chủ tịch A", "Mở khóa", "Đã chốt điểm", "forbidden"],
  ["Thư ký A", "Mở khóa", "Đã chốt điểm", "forbidden"],
  ["Thành viên A, Vắng", "Mở khóa", "Đã chốt điểm", "forbidden"],
  ["Tổ tư vấn A", "Mở khóa", "Đã chốt điểm", "forbidden"],
  ["Cán bộ Sở", "Mở khóa", "Đã chốt điểm", "forbidden"],
  ["Cán bộ xã", "Mở khóa", "Đã chốt điểm", "forbidden"],
  ["Chủ thể", "Mở khóa", "Đã chốt điểm", "forbidden"],
  ["Quản trị", "tra cứu theo mã", "Đã chốt điểm", "allowed"],
  ["Quản trị", "tra cứu theo mã", "Sẵn sàng chốt", "allowed"],
  ["Thư ký A", "tra cứu theo mã", "Đã chốt điểm", "forbidden"],
  ["Cán bộ Sở", "tra cứu theo mã", "Đã chốt điểm", "forbidden"],

  // Story 132: Quản trị neither Trả phiếu nor chốt nor reads điểm or the hồ sơ.
  ["Quản trị", "Trả phiếu Vắng", "Đã Mở khóa", "forbidden"],
  ["Quản trị", "chốt", "Đã Mở khóa", "forbidden"],
  ["Quản trị", "xem điểm", "Đã chốt điểm", "none"],
  ["Quản trị", "xem điểm", "Đã Mở khóa", "none"],
  ["Quản trị", "xem hồ sơ", "Đã chốt điểm", "forbidden"],
  ["Quản trị", "xem các kết quả chốt", "Đã Mở khóa", "forbidden"],

  // Story 130: after Mở khóa the Chủ tịch or Thư ký Trả phiếu (the Vắng too) and chốt again; not before.
  ["Chủ tịch A", "Trả phiếu Vắng", "Đã Mở khóa", "allowed"],
  ["Thư ký A", "Trả phiếu Vắng", "Đã Mở khóa", "allowed"],
  ["Thư ký A", "Trả phiếu Vắng", "Đã chốt điểm", "invalid_state"],
  ["Thư ký A", "chốt", "Đã Mở khóa", "allowed"],
  ["Chủ tịch A", "chốt", "Đã Mở khóa", "allowed"],
  ["Thư ký B", "chốt", "Đã Mở khóa", "not_found"],
  ["Thành viên A, Vắng", "chốt", "Đã Mở khóa", "forbidden"],
  ["Chủ tịch A", "xem điểm", "Đã Mở khóa", "full"],
  ["Cán bộ Sở", "xem điểm", "Đã Mở khóa", "none"],
  ["Chủ tịch A", "xem các kết quả chốt", "Đã Mở khóa", "allowed"],
  ["Thư ký A", "xem các kết quả chốt", "Đã chốt điểm", "allowed"],
  ["Thư ký B", "xem các kết quả chốt", "Đã Mở khóa", "not_found"],
  ["Thành viên A, Vắng", "xem các kết quả chốt", "Đã Mở khóa", "forbidden"],
  ["Tổ tư vấn A", "xem các kết quả chốt", "Đã Mở khóa", "forbidden"],
  ["Cán bộ Sở", "xem các kết quả chốt", "Đã Mở khóa", "forbidden"],
];

describe("Permission matrix: Mở khóa sau chốt (#63)", () => {
  const w = scoringWorld({ minGraders: 2 });
  const actors = {} as Record<Exclude<Who, "Chủ thể">, UserActor>;
  let admin: UserActor;
  beforeAll(async () => {
    admin = await w.f.admin();
    Object.assign(actors, {
      "Quản trị": admin,
      "Chủ tịch A": w.A.chair,
      "Thư ký A": w.A.secretary,
      "Thành viên A, Vắng": w.A.members[2]!,
      "Tổ tư vấn A": w.A.advisors[0]!,
      "Thư ký B": w.B.secretary,
      "Cán bộ Sở": w.province,
      "Cán bộ xã": w.ward,
    });
  });

  const confirmAll = async (actor: UserActor, dossierId: string) => {
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "own_sheet") throw new Error(view.kind);
    const lines = ["1.1:40", "2.1:25", "3.1:35"].map((key) => ({ criterionId: w.criterionId(key.split(":")[0]!), levelId: w.level(key), comment: "", evidenceFileIds: [] }));
    const { version } = await w.t.app.scoring.saveScoreSheet(actor, { dossierId, expectedVersion: view.sheet!.version, lines });
    await w.t.app.scoring.confirmScoreSheet(actor, { dossierId, expectedVersion: version });
  };
  const meeting = (actor: UserActor, dossierIds: string[]) =>
    w.t.app.scoring.createMeeting(actor, { roundId: w.roundId, title: "Phiên họp", heldOn: "2026-10-25", location: "Sở", dossierIds });
  const dossierOf = (dossierId: string) => w.t.app.dossiers.get(w.A.secretary, { dossierId });
  const unlock = async (dossierId: string, actor = admin) =>
    w.t.app.scoring.unlockFinalized(actor, { dossierId, requestFileId: await w.f.uploadPdf(admin, "unlock_request", "Công văn.pdf"), requestedBy: "Chủ tịch Hội đồng A", reason: "Sai sót" });

  async function dossierIn(state: State) {
    const d = await w.graded([w.A.members[0]!, w.A.members[1]!, w.A.members[2]!]);
    await confirmAll(w.A.members[0]!, d.dossierId);
    if (state !== "Thành viên xem xét") await confirmAll(w.A.members[1]!, d.dossierId);
    if (state === "Đã chốt điểm" || state === "Đã Mở khóa") {
      await meeting(w.A.secretary, [d.dossierId]);
      await w.t.app.scoring.finalize(w.A.secretary, { dossierId: d.dossierId, expectedVersion: (await dossierOf(d.dossierId)).version });
    }
    if (state === "Đã Mở khóa") await unlock(d.dossierId);
    return d;
  }

  async function attempt(who: Who, action: Action, d: { a: UserActor; dossierId: string }): Promise<Outcome> {
    const actor = who === "Chủ thể" ? d.a : actors[who];
    const { dossierId } = d;
    switch (action) {
      case "Mở khóa":
        // The văn bản is Quản trị's upload; nobody else may upload one at all.
        await unlock(dossierId, actor);
        return "allowed";
      case "tra cứu theo mã":
        await w.t.app.scoring.unlockTarget(actor, { code: (await dossierOf(dossierId)).code });
        return "allowed";
      case "Trả phiếu Vắng": {
        const view = await w.t.app.scoring.readDossierScores(w.A.chair, { dossierId });
        if (view.kind !== "full") throw new Error(view.kind);
        const sheetId = view.graders.find((g) => g.userId === w.A.members[2]!.userId)!.sheetId!;
        await w.t.app.scoring.returnScoreSheet(actor, { dossierId, sheetId, reason: "Chấm bổ sung" });
        return "allowed";
      }
      case "chốt": {
        // The Thư ký A has put the hồ sơ on a new Phiên họp's agenda first.
        await meeting(w.A.secretary, [dossierId]);
        await w.t.app.scoring.finalize(actor, { dossierId, expectedVersion: (await dossierOf(dossierId)).version });
        return "allowed";
      }
      case "xem điểm":
        return (await w.t.app.scoring.readDossierScores(actor, { dossierId })).kind as Outcome;
      case "xem hồ sơ":
        await w.t.app.dossiers.get(actor, { dossierId });
        return "allowed";
      case "xem các kết quả chốt":
        await w.t.app.scoring.finalizedResults(actor, { dossierId });
        return "allowed";
    }
  }

  it.each(ROWS)("%s / %s / %s → %s", async (who, action, state, outcome) => {
    const d = await dossierIn(state);
    const run = attempt(who, action, d);
    if (outcome === "allowed" || outcome === "full" || outcome === "none") await expect(run).resolves.toBe(outcome);
    else await expect(run).rejects.toMatchObject({ code: outcome });
  });
});
