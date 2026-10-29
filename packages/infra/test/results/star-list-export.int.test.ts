import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { XLSX_TYPE } from "@ocop/core";
import { FIVE, FOUR, resultsWorld, THREE, TWO } from "./results-world";

/*
 * L22 DC-05 Xuất Excel danh sách sản phẩm đạt sao (#91, spec #79 stories 83, 85, 86): the Cán bộ Sở exports, for the
 * cổng thông tin tỉnh, every Giấy chứng nhận issued (Hạng công nhận 3 or 4, read from the giấy, ADR 0009) and every hồ sơ
 * the Bộ công nhận 5 sao (số and ngày of the Bộ's quyết định, no số hiệu tỉnh), filtered by năm cấp and Hạng công nhận.
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

/** A date cell as Excel shows it, dd/mm/yyyy (the writer stores the wall-clock time in giờ Việt Nam). */
const shown = (v: ExcelJS.CellValue) => (v instanceof Date ? v.toISOString().slice(0, 10).split("-").reverse().join("/") : v);

describe("L22 Xuất Excel danh sách sản phẩm đạt sao (#91)", () => {
  const { w, closedMeeting, record, decisionFile } = resultsWorld();

  const dossier = (dossierId: string) => w.t.app.dossiers.get(w.province, { dossierId });
  const rowOf = (rows: Row[], code: string) => rows.filter((r) => r["Mã hồ sơ"] === code);
  const ministryFile = () => w.f.uploadPdf(w.province, "ministry_document", "Văn bản của Bộ.pdf");

  /** Hồ sơ 5 sao of one recorded Quyết định công nhận, each Đã gửi đề nghị 5 sao. */
  async function sentFiveStars(count: number) {
    const { meetingId, dossiers } = await closedMeeting(Array.from({ length: count }, () => FIVE));
    await record(meetingId);
    for (const d of dossiers) {
      await w.t.app.results.markFiveStarSent(w.province, {
        dossierId: d.dossierId,
        expectedVersion: (await dossier(d.dossierId)).version,
        dispatchNumber: "45/SNNMT-PTNT",
        sentOn: "2026-10-19",
      });
    }
    return Promise.all(dossiers.map((d) => dossier(d.dossierId)));
  }

  async function close(dossierId: string, input: { outcome: "ministry_recognized_5_star" | "other"; decisionNumber?: string; decidedOn?: string }) {
    await w.t.app.results.closeFiveStar(w.province, { dossierId, expectedVersion: (await dossier(dossierId)).version, fileId: await ministryFile(), ...input });
  }

  it("lists each Giấy chứng nhận issued with its sản phẩm, Chủ thể, xã, Nhóm sản phẩm, Hạng công nhận, số hiệu and dates; no hồ sơ không đạt (story 83)", async () => {
    const { meetingId, dossiers } = await closedMeeting([THREE, FOUR, TWO]);
    const { decisionId } = await record(meetingId, w.province, { signedOn: "2026-10-19" });
    const certs = await w.t.app.results.listCertificates(w.province, { decisionId });
    const [three, four, two] = await Promise.all(dossiers.map((d) => dossier(d.dossierId)));

    const file = await w.t.app.results.exportStarList(w.province, {});

    expect(file.contentType).toBe(XLSX_TYPE);
    expect(file.fileName).toMatch(/^danh-sach-san-pham-dat-sao-\d{8}-\d{4}\.xlsx$/);
    const { headers, rows } = await readBack(file.bytes);
    expect(headers).toEqual([
      "Mã hồ sơ",
      "Sản phẩm",
      "Chủ thể",
      "Xã/phường",
      "Nhóm sản phẩm",
      "Hạng công nhận",
      "Số hiệu giấy chứng nhận",
      "Ngày cấp",
      "Ngày hết hiệu lực",
      "Cơ quan công nhận",
      "Số quyết định",
      "Ngày quyết định",
    ]);
    expect(file.rowCount).toBe(rows.length);
    const fourCert = certs.find((c) => c.dossier.id === four!.id)!;
    expect(
      rowOf(rows, four!.code).map((r) => ({
        ...r,
        "Ngày cấp": shown(r["Ngày cấp"]),
        "Ngày hết hiệu lực": shown(r["Ngày hết hiệu lực"]),
        "Ngày quyết định": shown(r["Ngày quyết định"]),
      })),
    ).toEqual([
      {
        "Mã hồ sơ": four!.code,
        "Sản phẩm": four!.productName,
        "Chủ thể": four!.entity.name,
        "Xã/phường": four!.ward!.name,
        "Nhóm sản phẩm": four!.productGroup!.name,
        "Hạng công nhận": 4,
        "Số hiệu giấy chứng nhận": fourCert.code,
        "Ngày cấp": "19/10/2026",
        "Ngày hết hiệu lực": "19/10/2029",
        "Cơ quan công nhận": "UBND tỉnh",
        "Số quyết định": "123/QĐ-UBND",
        "Ngày quyết định": "19/10/2026",
      },
    ]);
    expect(rowOf(rows, three!.code).map((r) => r["Hạng công nhận"])).toEqual([3]);
    expect(rowOf(rows, two!.code)).toEqual([]);
  });

  it("lists a hồ sơ the Bộ công nhận 5 sao with the số and ngày of the Bộ's quyết định and no số hiệu tỉnh; not one closed otherwise or still awaiting the Bộ (story 83)", async () => {
    const [recognized, other, waiting] = await sentFiveStars(3);
    await close(recognized!.id, { outcome: "ministry_recognized_5_star", decisionNumber: "789/QĐ-BNNMT", decidedOn: "2026-10-15" });
    await close(other!.id, { outcome: "other" });

    const { rows } = await readBack((await w.t.app.results.exportStarList(w.province, {})).bytes);

    expect(rowOf(rows, recognized!.code).map((r) => ({ ...r, "Ngày quyết định": shown(r["Ngày quyết định"]) }))).toEqual([
      {
        "Mã hồ sơ": recognized!.code,
        "Sản phẩm": recognized!.productName,
        "Chủ thể": recognized!.entity.name,
        "Xã/phường": recognized!.ward!.name,
        "Nhóm sản phẩm": recognized!.productGroup!.name,
        "Hạng công nhận": 5,
        "Số hiệu giấy chứng nhận": null,
        "Ngày cấp": null,
        "Ngày hết hiệu lực": null,
        "Cơ quan công nhận": "Bộ Nông nghiệp và Môi trường",
        "Số quyết định": "789/QĐ-BNNMT",
        "Ngày quyết định": "15/10/2026",
      },
    ]);
    expect(rowOf(rows, other!.code)).toEqual([]);
    expect(rowOf(rows, waiting!.code)).toEqual([]);
  });

  it("lists a hồ sơ 5 sao the Bộ chuyển về and the tỉnh công nhận bổ sung with its Hạng công nhận 4, not its Hạng sao (ADR 0009)", async () => {
    const [returned] = await sentFiveStars(1);
    await w.t.app.results.returnFiveStarToProvince(w.province, {
      dossierId: returned!.id,
      expectedVersion: (await dossier(returned!.id)).version,
      fileId: await ministryFile(),
    });
    await w.t.app.results.recordSupplementaryDecision(w.province, {
      dossierIds: [returned!.id],
      number: "456/QĐ-UBND",
      signedOn: "2026-10-19",
      fileId: await decisionFile(),
    });

    const { rows } = await readBack((await w.t.app.results.exportStarList(w.province, { star: 4 })).bytes);

    expect(rowOf(rows, returned!.code).map((r) => [r["Hạng công nhận"], r["Cơ quan công nhận"], r["Số quyết định"]])).toEqual([
      [4, "UBND tỉnh", "456/QĐ-UBND"],
    ]);
  });

  it("narrows to the năm cấp and the Hạng công nhận; a Bộ công nhận 5 sao counts in the year of the Bộ's quyết định (story 83)", async () => {
    const earlier = await closedMeeting([THREE, FOUR]);
    await record(earlier.meetingId, w.province, { number: "9/QĐ-UBND", signedOn: "2025-12-30" });
    const [three2025, four2025] = await Promise.all(earlier.dossiers.map((d) => dossier(d.dossierId)));
    const later = await closedMeeting([FOUR]);
    await record(later.meetingId, w.province, { signedOn: "2026-01-05" });
    const four2026 = await dossier(later.dossiers[0]!.dossierId);
    const [five2026] = await sentFiveStars(1);
    await close(five2026!.id, { outcome: "ministry_recognized_5_star", decisionNumber: "790/QĐ-BNNMT", decidedOn: "2026-10-16" });
    const ours = [three2025!.code, four2025!.code, four2026.code, five2026!.code];
    const listed = async (input: { year?: number; star?: number }) => {
      const { rows } = await readBack((await w.t.app.results.exportStarList(w.province, input)).bytes);
      return rows
        .map((r) => r["Mã hồ sơ"] as string)
        .filter((code) => ours.includes(code))
        .sort();
    };

    expect(await listed({ year: 2025 })).toEqual([three2025!.code, four2025!.code].sort());
    expect(await listed({ star: 4 })).toEqual([four2025!.code, four2026.code].sort());
    expect(await listed({ year: 2026, star: 4 })).toEqual([four2026.code]);
    expect(await listed({ star: 5 })).toEqual([five2026!.code]);
    expect(await listed({ year: 2025, star: 5 })).toEqual([]);
    expect(await listed({ year: 2026, star: 5 })).toEqual([five2026!.code]);
  });

  it("refuses a năm or Hạng công nhận that is not one", async () => {
    await expect(w.t.app.results.exportStarList(w.province, { year: 2025.5 })).rejects.toMatchObject({ code: "invalid_filter" });
    await expect(w.t.app.results.exportStarList(w.province, { star: 2 })).rejects.toMatchObject({ code: "invalid_filter" });
  });

  it("audits each export with the loại danh sách, bộ lọc and số dòng (story 85)", async () => {
    const at = new Date(w.t.clock.now());
    const file = await w.t.app.results.exportStarList(w.province, { year: 2024, star: 3 });

    const admin = await w.f.admin();
    const entries = await w.t.app.audit.search(admin, { action: ["results.star_list.exported"], from: at, to: new Date(at.getTime() + 60_000) });
    // The world's clock stands still, so earlier tests' exports share the instant; only this one asks for 2024.
    const ours = entries.filter((e) => (e.metadata.filter as Record<string, number>).year === 2024);
    expect(ours.map((e) => [e.actorUserId, e.actorRole, e.targetType, e.metadata])).toEqual([
      [w.province.userId, "province_officer", "star_list", { list: "star_list", filter: { year: 2024, star: 3 }, rows: file.rowCount }],
    ]);
  });
});
