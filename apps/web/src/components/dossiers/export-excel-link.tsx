import type { DossierListInput } from "@ocop/core";
import { FileSpreadsheet } from "lucide-react";

/** The Xuất Excel route (#90) for a danh sách hồ sơ narrowed by `input`, the bộ lọc on screen. */
export function exportHref(input: DossierListInput): string {
  const q = new URLSearchParams(Object.entries(input).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""));
  const s = q.toString();
  return s ? `/xuat-excel/ho-so?${s}` : "/xuat-excel/ho-so";
}

/** L22 DC-05 (stories 80 to 82): downloads the danh sách hồ sơ as filtered on screen. */
export function ExportExcelLink({ input = {} }: { input?: DossierListInput }) {
  return (
    <a
      href={exportHref(input)}
      className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-semibold whitespace-nowrap"
      data-testid="export-excel"
    >
      <FileSpreadsheet className="size-4" aria-hidden /> Xuất Excel
    </a>
  );
}
