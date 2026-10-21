import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import type { UserActor } from "@ocop/core";
import { PRODUCT, entityIdOf } from "../dossiers/fixtures";
import { scoringWorld } from "./world";

/*
 * L15 HD-09, TM-11 (#62, spec #49 stories 110 to 115): the Thư ký sinh the văn bản họp of a Phiên họp from
 * the mẫu tạm (bảng tổng hợp điểm, dự thảo biên bản, dự thảo quyết định công nhận), with the kết quả chốt
 * where there is one and the điểm tính tại chỗ otherwise, and uploads the biên bản đã ký số.
 * Bộ tiêu chí of the world: 1.1 (A, 0/20/40, Sao tối thiểu 3 needs 20), 2.1 (B, 0/25), 3.1 (C, 0/35).
 */
describe("L15 văn bản họp and biên bản đã ký (#62)", () => {
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

  /** A hồ sơ Sẵn sàng chốt: thành viên 0 and 1 confirmed these điểm, thành viên 2 left a nháp. */
  async function ready(first: [number, number, number], second: [number, number, number]) {
    const d = await w.graded([m(0), m(1), m(2)]);
    await scoreAndConfirm(m(0), d.dossierId, first);
    await scoreAndConfirm(m(1), d.dossierId, second);
    const entity = await w.t.app.entities.getEntity(d.a, { entityId: entityIdOf(d.a) });
    return { ...d, entityName: entity.name };
  }

  async function finalize(actor: UserActor, dossierId: string) {
    const view = await w.t.app.scoring.readDossierScores(actor, { dossierId });
    if (view.kind !== "full") throw new Error(view.kind);
    await w.t.app.scoring.finalize(actor, { dossierId, expectedVersion: view.dossierVersion });
  }

  /**
   * A Phiên họp with three hồ sơ: `done` chốt at 72,5 (4 sao, Lệch điểm lớn, thành viên 2 Vắng), `best` still
   * waiting at 100 (5 sao), `low` waiting at 10 (1 sao).
   */
  async function meeting() {
    const done = await ready([40, 25, 35], [20, 25, 0]);
    const best = await ready([40, 25, 35], [40, 25, 35]);
    const low = await ready([0, 0, 0], [20, 0, 0]);
    const { meetingId } = await w.t.app.scoring.createMeeting(w.A.secretary, {
      roundId: w.roundId,
      title: "Phiên họp thứ nhất",
      heldOn: "2026-10-25",
      location: "Phòng họp Sở",
      dossierIds: [done.dossierId, best.dossierId, low.dossierId],
    });
    await finalize(w.A.secretary, done.dossierId);
    return { meetingId, done, best, low };
  }

  const text = async (actor: UserActor, meetingId: string, kind: "score_table" | "minutes" | "decision") => {
    const { fileName, bytes } = await w.t.app.scoring.generateMeetingDocument(actor, { meetingId, kind });
    expect(fileName).toMatch(/\.docx$/);
    return docxText(bytes);
  };

  it("sinh the bảng tổng hợp điểm: Chủ thể, sản phẩm, Bộ tiêu chí, điểm từng thành viên, tổng hợp, Hạng sao, cờ (story 110)", async () => {
    const { meetingId, done, best } = await meeting();

    const doc = await text(w.A.secretary, meetingId, "score_table");

    expect(doc).toContain("BẢNG TỔNG HỢP ĐIỂM");
    expect(doc).toContain("cần đối chiếu");
    expect(doc).toContain("Phiên họp thứ nhất, ngày 25/10/2026, tại Phòng họp Sở");
    expect(doc).toContain(`${done.entityName} | ${PRODUCT.productName} | 1 - Rau củ quả |`);
    expect(doc).toContain(`${m(0).fullName}: 100`);
    expect(doc).toContain(`${m(1).fullName}: 45`);
    expect(doc).toContain(`${m(2).fullName}: Vắng`);
    expect(doc).toContain("| 72,5 | 4 sao | Lệch điểm lớn (55 điểm) | Đã chốt |");
    // Not chốt yet: tính tại chỗ, the nháp shows as such and the văn bản says it is a bản nháp.
    expect(doc).toContain(`${best.entityName} | ${PRODUCT.productName}`);
    expect(doc).toContain(`${m(2).fullName}: Chưa xác nhận`);
    expect(doc).toContain("| 100 | 5 sao |  | Tạm tính |");
    expect(doc).toContain("Bản nháp: còn 2 hồ sơ chưa chốt điểm");
  });
});

function docxText(bytes: Uint8Array) {
  const xml = new PizZip(bytes).file("word/document.xml")!.asText();
  return xml
    .replace(/<\/w:p>\s*<\/w:tc>/g, " | ")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&");
}
