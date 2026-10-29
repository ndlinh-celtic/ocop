/*
 * Writes the Excel files users export (DC-05: danh sách hồ sơ #90, danh sách sản phẩm đạt sao #91). ExcelJS in
 * @ocop/infra. The file is built in memory and streamed to the user, never stored (spec #79 "Xuất Excel").
 */

/** A Date is an instant; the writer shows it in giờ Việt Nam (story 86). */
export type SpreadsheetCell = string | number | Date | null;

export interface SpreadsheetColumn {
  header: string;
  /** Character width; the writer picks one from the header when absent. */
  width?: number;
  /**
   * How the column's cells are shown: `datetime` dd/mm/yyyy hh:mm and `date` dd/mm/yyyy, both in giờ Việt Nam;
   * `decimal2` a number rounded to 2 chữ số thập phân (điểm, story 86); `integer` a whole number; text otherwise.
   */
  format?: "text" | "datetime" | "date" | "decimal2" | "integer";
}

export interface SpreadsheetSheet {
  name: string;
  columns: SpreadsheetColumn[];
  /** One array per row, in column order. */
  rows: SpreadsheetCell[][];
}

export interface SpreadsheetWriter {
  /** An .xlsx workbook with these sheets, each with a bold, frozen header row. */
  write(sheets: SpreadsheetSheet[]): Promise<Uint8Array>;
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
