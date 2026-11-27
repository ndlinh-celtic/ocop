import { auditEntry } from "../audit/audit";
import { XLSX_TYPE, type SpreadsheetCell, type SpreadsheetColumn } from "../documents/spreadsheet";
import { stamp, type ExportedFile } from "../dossiers/export";
import { summarize, type DossierSummary } from "../dossiers/read";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import type { Tx } from "../shared/uow";
import type { RecognitionDecision } from "./decision-model";

/*
 * L22 DC-05 Xuất Excel danh sách sản phẩm đạt sao (#91, spec #79 stories 83, 85, 86), for the cổng thông tin tỉnh. One row
 * per Giấy chứng nhận issued, its Hạng công nhận read from the giấy and not from the kết quả chốt (ADR 0009). Built in
 * memory and streamed, never stored. A hồ sơ the Bộ công nhận 5 sao has no Giấy chứng nhận of the tỉnh: its row carries the
 * số and ngày of the Bộ's quyết định instead (#87 `five_star_closure`).
 */

export interface StarListInput {
  /** Năm cấp. */
  year?: number;
  /** Hạng công nhận. */
  star?: number;
}

const COLUMNS: SpreadsheetColumn[] = [
  { header: "Mã hồ sơ", width: 18 },
  { header: "Sản phẩm", width: 36 },
  { header: "Chủ thể", width: 36 },
  { header: "Xã/phường", width: 24 },
  { header: "Nhóm sản phẩm", width: 28 },
  { header: "Hạng công nhận", width: 16, format: "integer" },
  { header: "Số hiệu giấy chứng nhận", width: 24 },
  { header: "Ngày cấp", width: 14, format: "date" },
  { header: "Ngày hết hiệu lực", width: 18, format: "date" },
  { header: "Cơ quan công nhận", width: 20 },
  { header: "Số quyết định", width: 20 },
  { header: "Ngày quyết định", width: 16, format: "date" },
];

/** The Hạng công nhận a sản phẩm đạt sao may have: 3 or 4 from the tỉnh, 5 from the Bộ. */
const STARS = [3, 4, 5];

function filterOf(input: StarListInput): StarListInput {
  const filter: StarListInput = {};
  if (input.year !== undefined) {
    if (!Number.isInteger(input.year)) throw new DomainError("invalid_filter", "Năm không hợp lệ");
    filter.year = input.year;
  }
  if (input.star !== undefined) {
    if (!STARS.includes(input.star)) throw new DomainError("invalid_filter", "Hạng công nhận không hợp lệ");
    filter.star = input.star;
  }
  return filter;
}

const PROVINCE = "UBND tỉnh";
const MINISTRY = "Bộ Nông nghiệp và Môi trường";

/** A YYYY-MM-DD day as the instant of its midnight in giờ Việt Nam, which the writer shows as that day. */
const dayCell = (day: string | null): Date | null => (day ? new Date(`${day}T00:00:00+07:00`) : null);

/** Story 83: the sản phẩm đạt sao the Cán bộ Sở publishes. */
export function exportStarList(deps: CoreDeps) {
  return async (actor: Actor, input: StarListInput = {}): Promise<ExportedFile> => {
    authorize(actor, "results.star_list.export");
    const filter = filterOf(input);
    const now = deps.clock.now();
    return deps.uow.run(async (tx) => {
      const scope = dataScopeOf(actor);
      const certificates = (await tx.certificates.list(filter.year === undefined ? {} : { year: filter.year })).filter(
        (c) => filter.star === undefined || c.recognizedStar === filter.star,
      );
      const closures =
        filter.star === undefined || filter.star === 5
          ? (await tx.fiveStar.closures("ministry_recognized_5_star")).filter((c) => filter.year === undefined || c.decidedOn?.startsWith(`${filter.year}-`))
          : [];
      const dossiers = [];
      for (const id of [...certificates.map((c) => c.dossierId), ...closures.map((c) => c.dossierId)]) {
        const d = await tx.dossiers.findById(scope, id);
        if (d) dossiers.push(d);
      }
      const summaries = new Map((await summarize(tx, scope, dossiers, now, actor.activeRole)).map((s) => [s.id, s]));
      const product = (s: DossierSummary): SpreadsheetCell[] => [s.code, s.productName, s.entity.name, s.ward?.name ?? null, s.productGroup?.name ?? null];
      const decisions = new Map<string, RecognitionDecision | null>();
      const rows: SpreadsheetCell[][] = [];
      for (const c of certificates) {
        const s = summaries.get(c.dossierId);
        if (!s) continue;
        const decision = await decisionOf(tx, decisions, c.decisionId);
        rows.push([
          ...product(s),
          c.recognizedStar,
          c.code,
          dayCell(c.issuedOn),
          dayCell(c.expiresOn),
          PROVINCE,
          decision?.number ?? null,
          dayCell(decision?.signedOn ?? null),
        ]);
      }
      // Bộ công nhận 5 sao: no Giấy chứng nhận of the tỉnh, so no số hiệu, ngày cấp or ngày hết hiệu lực.
      for (const c of closures) {
        const s = summaries.get(c.dossierId);
        if (s) rows.push([...product(s), 5, null, null, null, MINISTRY, c.decisionNumber, dayCell(c.decidedOn)]);
      }
      const bytes = await deps.spreadsheets.write([{ name: "Sản phẩm đạt sao", columns: COLUMNS, rows }]);
      // Story 85: the file has personal data (NĐ 13/2023), so each export is audited in the same transaction.
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "results.star_list.exported",
          targetType: "star_list",
          metadata: { list: "star_list", filter: { ...filter }, rows: rows.length },
        }),
      );
      return { fileName: `danh-sach-san-pham-dat-sao-${stamp(now)}.xlsx`, contentType: XLSX_TYPE, bytes, rowCount: rows.length };
    });
  };
}

async function decisionOf(tx: Tx, cache: Map<string, RecognitionDecision | null>, id: string) {
  if (!cache.has(id)) cache.set(id, await tx.recognitionDecisions.findById(id));
  return cache.get(id) ?? null;
}
