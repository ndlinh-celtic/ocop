import type { GraderProgress, SupersededSheet } from "@ocop/core";
import { formatPoints } from "@/components/scoring/aggregate-table";
import { formatVnDateTime } from "@/lib/format";
import { ReturnSheetButton } from "./return-sheet";

const SHEET_STATE: Record<string, string> = { draft: "Đang chấm", confirmed: "Đã xác nhận", absent: "Vắng", superseded: "Bị thay thế" };

/**
 * L15 HD-05 (stories 102 to 104): each thành viên chấm with the state of their phiếu and "Trả phiếu" on a phiếu đã
 * xác nhận (or Vắng); below, the phiếu bị thay thế with their lý do, which only the Chủ tịch and Thư ký read.
 */
export function ReturnPanel({ dossierId, graders, history }: { dossierId: string; graders: GraderProgress[]; history: SupersededSheet[] }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-surface p-4 shadow-card" aria-labelledby="tra-phieu">
      <div>
        <h2 id="tra-phieu" className="font-semibold">
          Phiếu của thành viên
        </h2>
        <p className="text-sm text-text-2">Trả phiếu cho thành viên cần chấm lại sau thảo luận, trước khi chốt.</p>
      </div>
      <ul className="divide-y text-sm">
        {graders.map((g) => (
          <li key={g.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              {g.fullName} <span className="text-text-2">· {g.state ? SHEET_STATE[g.state] : "Chưa có phiếu"}</span>
              {g.confirmedAt && <span className="text-text-3"> · {formatVnDateTime(g.confirmedAt)}</span>}
            </span>
            {g.sheetId && (g.state === "confirmed" || g.state === "absent") && (
              <ReturnSheetButton dossierId={dossierId} sheetId={g.sheetId} fullName={g.fullName} absent={g.state === "absent"} />
            )}
          </li>
        ))}
      </ul>
      {history.length > 0 && (
        <details className="text-sm" data-testid="superseded-sheets">
          <summary className="cursor-pointer font-medium">Lịch sử phiếu bị thay thế ({history.length})</summary>
          <ul className="mt-2 flex flex-col gap-3">
            {history.map((h) => (
              <li key={h.sheetId} className="rounded-md border p-3">
                <p>
                  <b>{h.fullName}</b> · lần chấm {h.attempt} · tổng {formatPoints(h.total)}
                  {h.returnedAt && <span className="text-text-3"> · Trả phiếu lúc {formatVnDateTime(h.returnedAt)}</span>}
                </p>
                {h.reason && <p className="text-text-2">Lý do: {h.reason}</p>}
                <ul className="mt-1 text-text-2">
                  {h.lines.map((l) => (
                    <li key={l.criterionId}>
                      <span className="font-mono">{l.code}</span>: {l.points === null ? "chưa chấm" : formatPoints(l.points)}
                      {l.comment && ` · ${l.comment}`}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
