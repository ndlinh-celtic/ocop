import type { LegalDocumentView, LegalStandingView, RequirementState } from "@ocop/core";
import type { ReactNode } from "react";
import { DownloadButton } from "@/components/download-button";
import { formatIsoDate, formatVnDateTime } from "@/lib/format";
import { downloadLegalDocumentAction } from "./actions";

export const REQUIREMENT_STATE: Record<RequirementState, { label: string; style: string }> = {
  valid: { label: "Còn hiệu lực", style: "bg-brand-soft text-brand" },
  expired: { label: "Đã hết hạn", style: "bg-amber-soft text-amber" },
  scanning: { label: "Đang quét tệp", style: "bg-surface-2 text-text-2 ring-1 ring-line-strong" },
  blocked: { label: "Tệp bị chặn", style: "bg-amber-soft text-danger" },
  missing: { label: "Chưa có", style: "bg-surface-2 text-text-3 ring-1 ring-line-strong" },
};

export function StateTag({ state }: { state: RequirementState }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${REQUIREMENT_STATE[state].style}`}>{REQUIREMENT_STATE[state].label}</span>
  );
}

const docState = (d: LegalDocumentView): RequirementState =>
  d.file.status === "clean" ? (d.expired ? "expired" : "valid") : d.file.status === "blocked" ? "blocked" : "scanning";

/** Each Loại giấy tờ, whether the Chủ thể's Loại tổ chức requires it, and where it stands today. */
export function RequirementList({ standing }: { standing: LegalStandingView }) {
  return (
    <section className="rounded-lg border bg-surface shadow-card">
      <h2 className="border-b p-4 font-semibold">Loại giấy tờ</h2>
      <ul className="divide-y">
        {standing.requirements.map((r) => (
          <li key={r.typeCode} className="flex items-center justify-between gap-3 px-4 py-2 text-sm" data-testid="requirement">
            <span>
              {r.name}
              {r.required && <span className="ml-2 text-xs font-medium text-danger">Bắt buộc</span>}
            </span>
            <StateTag state={r.state} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Giấy tờ pháp lý of a Chủ thể, current or replaced, each downloadable once scanned clean. `actions` adds
 * what the reader may do with a current one (the Chủ thể replaces it).
 */
export function DocumentTable({
  documents,
  entityId,
  current,
  actions,
}: {
  documents: LegalDocumentView[];
  entityId: string;
  current: boolean;
  actions?: (d: LegalDocumentView) => ReactNode;
}) {
  const download = downloadLegalDocumentAction.bind(null, entityId);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-surface-2">
          <tr>
            <th className="px-4 py-2">Loại giấy tờ</th>
            <th className="px-4 py-2">Số</th>
            <th className="px-4 py-2">Ngày cấp</th>
            <th className="px-4 py-2">Hiệu lực đến</th>
            <th className="px-4 py-2">{current ? "Trạng thái" : "Được thay ngày"}</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.id} className="border-b align-top last:border-0" data-testid="legal-document-row">
              <td className="px-4 py-2">
                {d.typeName}
                <span className="block text-xs text-text-3">{d.file.fileName}</span>
              </td>
              <td className="px-4 py-2">{d.documentNumber ?? "—"}</td>
              <td className="px-4 py-2">{formatIsoDate(d.issuedOn)}</td>
              <td className="px-4 py-2">{d.validUntil ? formatIsoDate(d.validUntil) : "Không thời hạn"}</td>
              <td className="px-4 py-2">{current ? <StateTag state={docState(d)} /> : d.replacedAt && formatVnDateTime(d.replacedAt)}</td>
              <td className="px-4 py-2 text-right">
                <div className="flex flex-col items-end gap-2">
                  {d.file.status === "clean" && <DownloadButton fileId={d.id} download={download} />}
                  {current && actions?.(d)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
