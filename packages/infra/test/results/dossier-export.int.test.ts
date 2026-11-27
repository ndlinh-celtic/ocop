import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { XLSX_TYPE, type UserActor } from "@ocop/core";
import { seedWards } from "../../src/seed/wards";
import { scoringWorld } from "../scoring/world";

/*
 * L22 DC-05 Xuất Excel danh sách hồ sơ (#90, spec #79 stories 80 to 82, 84 to 87): the Cán bộ xã, Cán bộ Sở, Chủ tịch and
 * Thư ký export the hồ sơ of their Phạm vi as filtered on screen. The điểm tổng hợp and Hạng sao of the kết quả chốt
 * hiện hành appear only for who may see that tổng hợp; never a thành viên's điểm. Each export is audited.
 * Bộ tiêu chí of the world: 1.1 (A, 0/20/40), 2.1 (B, 0/25), 3.1 (C, 0/35).
 */

type Row = Record<string, ExcelJS.CellValue>;

async function readBack(bytes: Uint8Array) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  const sheet = book.worksheets[0]!;
  const headers = (sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1).map(String);
  const rows: Row[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    rows.push(Object.fromEntries(headers.map((h, i) => [h, row.getCell(i + 1).value ?? null])));
  });
  return { sheet, headers, rows };
}

describe("L22 Xuất Excel danh sách hồ sơ (#90)", () => {
  const w = scoringWorld({ minGraders: 2 });
  const m = (i: number) => w.A.members[i]!;
  let otherWard: UserActor;

  beforeAll(async () => {
    await seedWards(w.db.app, "ma,ten\n00002,Xã Bình Minh\n");
    const ward2 = (await w.t.app.org.listWards()).find((x) => x.name === "Xã Bình Minh")!;
    otherWard = await w.f.staff("ward_officer", ward2.id);
  });

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

  /** A hồ sơ Đã chốt điểm: [40,25,35] and [20,25,0] average 72,5 điểm, 4 sao. */
  async function finalized() {
    const d = await w.graded([m(0), m(1)]);
    await scoreAndConfirm(m(0), d.dossierId, [40, 25, 35]);
    await scoreAndConfirm(m(1), d.dossierId, [20, 25, 0]);
    await w.t.app.scoring.createMeeting(w.A.secretary, {
      roundId: w.roundId,
      title: "Phiên họp",
      heldOn: "2026-10-25",
      location: "Sở",
      dossierIds: [d.dossierId],
    });
    const { version } = await w.t.app.dossiers.get(w.A.secretary, { dossierId: d.dossierId });
    await w.t.app.scoring.finalize(w.A.secretary, { dossierId: d.dossierId, expectedVersion: version });
    return w.t.app.dossiers.get(w.province, { dossierId: d.dossierId });
  }

  it("gives the Cán bộ Sở every column and the điểm tổng hợp, Hạng sao of a hồ sơ Đã chốt điểm (stories 81, 86, 87)", async () => {
    const done = await finalized();
    const pending = await w.t.app.dossiers.get(w.province, { dossierId: (await w.graded([m(2), m(3)])).dossierId });

    const file = await w.t.app.dossiers.exportDossiers(w.province, {});

    expect(file.contentType).toBe(XLSX_TYPE);
    expect(file.fileName).toMatch(/^danh-sach-ho-so-\d{8}-\d{4}\.xlsx$/);
    const { headers, rows } = await readBack(file.bytes);
    expect(headers).toEqual([
      "Mã hồ sơ",
      "Sản phẩm",
      "Chủ thể",
      "Xã/phường",
      "Đợt đánh giá",
      "Bộ tiêu chí",
      "Trạng thái",
      "Ngày nộp",
      "Điểm tổng hợp",
      "Hạng sao",
    ]);
    expect(file.rowCount).toBe(rows.length);
    const row = rows.find((r) => r["Mã hồ sơ"] === done.code)!;
    expect(row).toMatchObject({
      "Sản phẩm": done.productName,
      "Chủ thể": done.entity.name,
      "Xã/phường": "Xã An Phú",
      "Đợt đánh giá": done.round!.name,
      "Bộ tiêu chí": done.criteriaSet.name,
      "Trạng thái": "Đã chốt điểm",
      "Điểm tổng hợp": 72.5,
      "Hạng sao": 4,
    });
    // Ngày nộp in giờ Việt Nam: ExcelJS reads the wall-clock time back as if it were UTC.
    expect((row["Ngày nộp"] as Date).getTime()).toBe(done.submittedAt!.getTime() + 7 * 3_600_000);
    expect(rows.find((r) => r["Mã hồ sơ"] === pending.code)).toMatchObject({ "Trạng thái": "Thành viên xem xét", "Điểm tổng hợp": null, "Hạng sao": null });
  });

  it("never writes a thành viên's name or điểm (story 87)", async () => {
    await finalized();
    for (const actor of [w.province, w.A.chair, w.A.secretary]) {
      const { sheet } = await readBack((await w.t.app.dossiers.exportDossiers(actor, {})).bytes);
      const text = JSON.stringify(sheet.getSheetValues());
      for (const x of [m(0), m(1)]) expect(text).not.toContain(x.fullName);
    }
  });

  it("gives the Chủ tịch and Thư ký the hồ sơ of their Hội đồng with the tổng hợp, another Hội đồng none of them (story 82)", async () => {
    const done = await finalized();
    for (const actor of [w.A.chair, w.A.secretary]) {
      const { rows } = await readBack((await w.t.app.dossiers.exportDossiers(actor, {})).bytes);
      expect(rows.find((r) => r["Mã hồ sơ"] === done.code)).toMatchObject({ "Điểm tổng hợp": 72.5, "Hạng sao": 4 });
    }
    const { rows } = await readBack((await w.t.app.dossiers.exportDossiers(w.B.chair, {})).bytes);
    expect(rows.find((r) => r["Mã hồ sơ"] === done.code)).toBeUndefined();
  });

  it("gives the Cán bộ xã the hồ sơ of their xã only, without the điểm columns (story 80)", async () => {
    const done = await finalized();
    const own = await readBack((await w.t.app.dossiers.exportDossiers(w.ward, {})).bytes);
    expect(own.headers).not.toContain("Điểm tổng hợp");
    expect(own.headers).not.toContain("Hạng sao");
    expect(own.rows.find((r) => r["Mã hồ sơ"] === done.code)).toMatchObject({ "Trạng thái": "Đã chốt điểm" });

    const other = await w.t.app.dossiers.exportDossiers(otherWard, {});
    expect(other.rowCount).toBe(0);
    expect((await readBack(other.bytes)).rows).toEqual([]);
  });

  it("exports what the filter on screen narrows to", async () => {
    const done = await finalized();
    await w.graded([m(2), m(3)]);
    const file = await w.t.app.dossiers.exportDossiers(w.province, { state: "score_finalized" });
    const { rows } = await readBack(file.bytes);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r["Trạng thái"] === "Đã chốt điểm")).toBe(true);
    expect(rows.map((r) => r["Mã hồ sơ"])).toContain(done.code);
  });

  it("audits each export with the loại danh sách, bộ lọc and số dòng (story 85)", async () => {
    await finalized();
    const at = new Date(w.t.clock.now());
    const file = await w.t.app.dossiers.exportDossiers(w.province, { state: "score_finalized", roundId: w.roundId });

    const admin = await w.f.admin();
    const entries = await w.t.app.audit.search(admin, { action: ["dossier.exported"], from: at, to: new Date(at.getTime() + 60_000) });
    // The world's clock stands still, so earlier tests' exports share the instant; only this one filters by đợt.
    const ours = entries.filter((e) => (e.metadata.filter as Record<string, string>).roundId !== undefined);
    expect(ours.map((e) => [e.actorUserId, e.actorRole, e.metadata])).toEqual([
      [w.province.userId, "province_officer", { list: "dossiers", filter: { state: "score_finalized", roundId: w.roundId }, rows: file.rowCount }],
    ]);
  });
});
