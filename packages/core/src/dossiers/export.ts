import { auditEntry } from "../audit/audit";
import { XLSX_TYPE, type SpreadsheetCell, type SpreadsheetColumn } from "../documents/spreadsheet";
import { authorize } from "../identity/policy";
import type { Role } from "../identity/roles";
import { vnDateOf } from "../rounds/model";
import { scoresVisibility } from "../scoring/read";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import type { Tx } from "../shared/uow";
import { DOSSIER_STATE_LABEL } from "./model";
import { listIn, type DossierListInput, type DossierSummary } from "./read";

/*
 * L22 DC-05 Xuất Excel danh sách hồ sơ (#90, spec #79 stories 80 to 82, 84 to 87): the list on screen, same Phạm vi and
 * bộ lọc, as an .xlsx streamed to the user and never stored. The điểm tổng hợp and Hạng sao are those of the kết quả chốt
 * hiện hành, only for a Vai trò that may see the tổng hợp of that hồ sơ (`scoresVisibility`); never a thành viên's điểm.
 */

export interface ExportedFile {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  /** Rows of data, the header row aside. */
  rowCount: number;
}

const COLUMNS: SpreadsheetColumn[] = [
  { header: "Mã hồ sơ", width: 18 },
  { header: "Sản phẩm", width: 36 },
  { header: "Chủ thể", width: 36 },
  { header: "Xã/phường", width: 24 },
  { header: "Đợt đánh giá", width: 28 },
  { header: "Bộ tiêu chí", width: 32 },
  { header: "Trạng thái", width: 26 },
  { header: "Ngày nộp", width: 18, format: "datetime" },
];
const SCORE_COLUMNS: SpreadsheetColumn[] = [
  { header: "Điểm tổng hợp", width: 16, format: "decimal2" },
  { header: "Hạng sao", width: 10, format: "integer" },
];
/** The Vai trò that may see a tổng hợp at all among those who export; the Cán bộ xã never does (story 80). */
const SCORE_ROLES: readonly Role[] = ["province_officer", "council_chair", "council_secretary"];

/** The bộ lọc as given, without blanks, for the audit row (story 85). */
function filterOf(input: DossierListInput): Record<string, string> {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => typeof v === "string" && v !== ""));
}

async function scoreCells(tx: Tx, actor: UserActor, d: DossierSummary): Promise<SpreadsheetCell[]> {
  const result = await tx.aggregateResults.current(d.id);
  const visibility = scoresVisibility({ role: actor.activeRole, state: d.state, ownSheetConfirmed: false, finalized: result !== null });
  // Hạng sao is the stored one, never recomputed (CODING_STANDARDS "Hạng sao").
  return result && (visibility === "full" || visibility === "aggregate_only") ? [result.total, result.star] : [null, null];
}

/** Stories 80 to 82, 85 to 87: the hồ sơ the exporter sees, narrowed as on screen, with an audit row of the export. */
export function exportDossiers(deps: CoreDeps) {
  return async (actor: Actor, input: DossierListInput = {}): Promise<ExportedFile> => {
    authorize(actor, "dossier.export");
    const now = deps.clock.now();
    const withScores = actor.activeRole !== null && SCORE_ROLES.includes(actor.activeRole);
    return deps.uow.run(async (tx) => {
      const dossiers = await listIn(tx, actor, input, now);
      const rows: SpreadsheetCell[][] = [];
      for (const d of dossiers) {
        rows.push([
          d.code,
          d.productName,
          d.entity.name,
          d.ward?.name ?? null,
          d.round?.name ?? null,
          d.criteriaSet.name,
          DOSSIER_STATE_LABEL[d.state],
          d.submittedAt,
          ...(withScores ? await scoreCells(tx, actor, d) : []),
        ]);
      }
      const bytes = await deps.spreadsheets.write([{ name: "Danh sách hồ sơ", columns: withScores ? [...COLUMNS, ...SCORE_COLUMNS] : COLUMNS, rows }]);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "dossier.exported",
          targetType: "dossier_list",
          metadata: { list: "dossiers", filter: filterOf(input), rows: rows.length },
        }),
      );
      return { fileName: `danh-sach-ho-so-${stamp(now)}.xlsx`, contentType: XLSX_TYPE, bytes, rowCount: rows.length };
    });
  };
}

/** YYYYMMDD-HHmm in giờ Việt Nam. */
function stamp(at: Date): string {
  const time = new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(11, 16).replace(":", "");
  return `${vnDateOf(at).replaceAll("-", "")}-${time}`;
}
