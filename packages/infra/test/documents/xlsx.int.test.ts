/**
 * The ExcelJS adapter of SpreadsheetWriter (#90, DC-05): writes a workbook and reads it back with ExcelJS (spec #79 "Test").
 */
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { excelSpreadsheetWriter } from "../../src/documents/xlsx";

async function readBack(bytes: Uint8Array) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  return book;
}

describe("excelSpreadsheetWriter (#90)", () => {
  it("writes each sheet with its header row and rows, text kept as Vietnamese", async () => {
    const bytes = await excelSpreadsheetWriter().write([
      {
        name: "Hồ sơ",
        columns: [{ header: "Mã hồ sơ" }, { header: "Sản phẩm" }, { header: "Ghi chú" }],
        rows: [
          ["HS-2026-0001", "Mật ong rừng U Minh", null],
          ["HS-2026-0002", "Trà shan tuyết", "Đã chốt điểm"],
        ],
      },
      { name: "Trống", columns: [{ header: "Cột" }], rows: [] },
    ]);

    const book = await readBack(bytes);
    expect(book.worksheets.map((s) => s.name)).toEqual(["Hồ sơ", "Trống"]);
    const sheet = book.getWorksheet("Hồ sơ")!;
    expect(sheet.getRow(1).values).toEqual([undefined, "Mã hồ sơ", "Sản phẩm", "Ghi chú"]);
    expect(sheet.getRow(1).font?.bold).toBe(true);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.getRow(2).values).toEqual([undefined, "HS-2026-0001", "Mật ong rừng U Minh"]);
    expect(sheet.getRow(3).values).toEqual([undefined, "HS-2026-0002", "Trà shan tuyết", "Đã chốt điểm"]);
    expect(sheet.rowCount).toBe(3);
    expect(book.getWorksheet("Trống")!.rowCount).toBe(1);
  });

  it("shows an instant in giờ Việt Nam and điểm with 2 chữ số thập phân (story 86)", async () => {
    // 2026-10-27 17:30 UTC is 28/10/2026 00:30 in Việt Nam (UTC+7).
    const at = new Date("2026-10-27T17:30:00Z");
    const bytes = await excelSpreadsheetWriter().write([
      {
        name: "S",
        columns: [
          { header: "Ngày nộp", format: "datetime" },
          { header: "Ngày cấp", format: "date" },
          { header: "Điểm", format: "decimal2" },
          { header: "Hạng sao", format: "integer" },
        ],
        rows: [[at, at, 72.456, 4]],
      },
    ]);

    const row = (await readBack(bytes)).getWorksheet("S")!.getRow(2);
    // ExcelJS reads a cell date back as if its wall-clock time were UTC.
    expect((row.getCell(1).value as Date).toISOString()).toBe("2026-10-28T00:30:00.000Z");
    expect(row.getCell(1).numFmt).toBe("dd/mm/yyyy hh:mm");
    expect((row.getCell(2).value as Date).toISOString()).toBe("2026-10-28T00:30:00.000Z");
    expect(row.getCell(2).numFmt).toBe("dd/mm/yyyy");
    expect(row.getCell(3).value).toBe(72.46);
    expect(row.getCell(3).numFmt).toBe("0.00");
    expect(row.getCell(4).value).toBe(4);
    expect(row.getCell(4).numFmt).toBe("0");
  });
});
