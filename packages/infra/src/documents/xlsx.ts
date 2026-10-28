import ExcelJS from "exceljs";
import type { SpreadsheetCell, SpreadsheetColumn, SpreadsheetSheet, SpreadsheetWriter } from "@ocop/core";

/** Việt Nam keeps UTC+7 all year (no daylight saving). */
const VN_OFFSET_MS = 7 * 3_600_000;

const NUM_FMT: Record<NonNullable<SpreadsheetColumn["format"]>, string | undefined> = {
  text: undefined,
  datetime: "dd/mm/yyyy hh:mm",
  date: "dd/mm/yyyy",
  decimal2: "0.00",
  integer: "0",
};

/**
 * Excel has no time zone: a cell holds a wall-clock time. An instant is written as its wall-clock time in Việt Nam
 * (story 86), and a điểm rounded to 2 chữ số thập phân so the stored value matches what is shown.
 */
function cellValue(value: SpreadsheetCell, format: SpreadsheetColumn["format"]): ExcelJS.CellValue {
  if (value === null) return null;
  if (value instanceof Date) return new Date(value.getTime() + VN_OFFSET_MS);
  if (typeof value === "number" && format === "decimal2") return Math.round(value * 100) / 100;
  if (typeof value === "number" && format === "integer") return Math.round(value);
  return value;
}

/** The SpreadsheetWriter of @ocop/core with ExcelJS, built in memory (#90). */
export function excelSpreadsheetWriter(): SpreadsheetWriter {
  return {
    async write(sheets: SpreadsheetSheet[]) {
      const book = new ExcelJS.Workbook();
      for (const s of sheets) {
        const sheet = book.addWorksheet(s.name, { views: [{ state: "frozen", ySplit: 1 }] });
        sheet.columns = s.columns.map((c, i) => ({
          key: String(i),
          header: c.header,
          width: c.width ?? Math.max(12, c.header.length + 4),
          ...(NUM_FMT[c.format ?? "text"] ? { style: { numFmt: NUM_FMT[c.format ?? "text"] } } : {}),
        }));
        sheet.getRow(1).font = { bold: true };
        for (const row of s.rows) sheet.addRow(row.map((v, i) => cellValue(v, s.columns[i]?.format)));
      }
      return new Uint8Array(await book.xlsx.writeBuffer());
    },
  };
}
