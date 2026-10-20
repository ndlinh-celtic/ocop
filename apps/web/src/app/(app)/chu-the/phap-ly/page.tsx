import type { LegalDocumentView, RequirementState } from "@ocop/core";
import { BadgeCheck, CircleAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { DownloadButton } from "@/components/download-button";
import { EntityProfile } from "@/components/entities/entity-profile";
import { RefreshWhileScanning } from "@/components/refresh-while-scanning";
import { formatIsoDate, formatVnDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { downloadLegalFileAction } from "./actions";
import { EntityForm } from "./entity-form";
import { LegalDocumentForm } from "./legal-document-form";
import { ReplaceDocument } from "./replace-document";
import { RevealPersonalId } from "./reveal-personal-id";

export const dynamic = "force-dynamic";

const STATE: Record<RequirementState, { label: string; style: string }> = {
  valid: { label: "Còn hiệu lực", style: "bg-brand-soft text-brand" },
  expired: { label: "Đã hết hạn", style: "bg-amber-soft text-amber" },
  scanning: { label: "Đang quét tệp", style: "bg-surface-2 text-text-2 ring-1 ring-line-strong" },
  blocked: { label: "Tệp bị chặn", style: "bg-amber-soft text-danger" },
  missing: { label: "Chưa có", style: "bg-surface-2 text-text-3 ring-1 ring-line-strong" },
};

function StateTag({ state }: { state: RequirementState }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATE[state].style}`}>{STATE[state].label}</span>;
}

const docState = (d: LegalDocumentView): RequirementState =>
  d.file.status === "clean" ? (d.expired ? "expired" : "valid") : d.file.status === "blocked" ? "blocked" : "scanning";

function DocumentTable({ documents, entityId, current }: { documents: LegalDocumentView[]; entityId: string; current: boolean }) {
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
                  {d.file.status === "clean" && <DownloadButton fileId={d.fileId} download={downloadLegalFileAction} />}
                  {current && <ReplaceDocument entityId={entityId} document={d} />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * S11 Hồ sơ pháp lý of the signed-in Chủ thể (L01 CT-01, CT-02): its organisation details, which it may
 * edit, and its giấy tờ pháp lý with Đã xác thực computed as of now. The Chủ thể is the Phạm vi of the
 * Vai trò đang dùng.
 */
export default async function LegalProfilePage() {
  const actor = await requireActor();
  const entityId = actor.activeScope?.type === "entity" ? actor.activeScope.id : null;
  if (!entityId) notFound();
  const [entity, standing, wards] = await Promise.all([
    app().core.entities.getEntity(actor, { entityId }).catch(orNotFound),
    app().core.entities.getLegalStanding(actor, { entityId }).catch(orNotFound),
    app().core.org.listWards(),
  ]);
  if (!entity || !standing) notFound();
  const missing = standing.requirements.filter((r) => r.required && r.state !== "valid");
  const types = standing.requirements.map((r) => ({ code: r.typeCode, name: r.name }));

  return (
    <div className="flex flex-col gap-6">
      <RefreshWhileScanning active={standing.documents.some((d) => d.file.status === "scanning")} />
      <div>
        <h1 className="text-xl font-semibold">Hồ sơ pháp lý</h1>
        <p className="text-sm text-text-2">Thông tin của {entity.name}, dùng chung cho tất cả hồ sơ sản phẩm.</p>
      </div>

      {standing.verified ? (
        <div role="status" data-testid="verified" className="flex items-start gap-3 rounded-lg bg-brand-soft p-4 text-sm">
          <BadgeCheck className="size-5 shrink-0 text-brand" aria-hidden />
          <p>
            <b>Đã xác thực.</b> Bạn có đủ giấy tờ bắt buộc còn hiệu lực và có thể lập hồ sơ sản phẩm. Cán bộ xã sẽ kiểm tra tính hợp lệ khi tiếp nhận từng hồ sơ.
          </p>
        </div>
      ) : (
        <div role="status" data-testid="not-verified" className="flex items-start gap-3 rounded-lg bg-amber-soft p-4 text-sm">
          <CircleAlert className="size-5 shrink-0 text-amber" aria-hidden />
          <div>
            <b>Chưa xác thực.</b> Cần bổ sung giấy tờ bắt buộc còn hiệu lực:
            <ul className="mt-1 list-disc pl-5">
              {missing.map((r) => (
                <li key={r.typeCode}>
                  {r.name} ({STATE[r.state].label.toLowerCase()})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

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

      <section className="rounded-lg border bg-surface shadow-card">
        <h2 className="border-b p-4 font-semibold">Giấy tờ hiện có</h2>
        {standing.documents.length > 0 ? (
          <DocumentTable documents={standing.documents} entityId={entity.id} current />
        ) : (
          <p className="px-4 py-6 text-center text-sm text-text-3">Chưa có giấy tờ nào.</p>
        )}
      </section>

      <section className="rounded-lg border bg-surface p-4 shadow-card">
        <h2 className="mb-3 font-semibold">Thêm giấy tờ</h2>
        <LegalDocumentForm entityId={entity.id} types={types} />
      </section>

      {standing.history.length > 0 && (
        <section className="rounded-lg border bg-surface shadow-card">
          <h2 className="border-b p-4 font-semibold">Lịch sử giấy tờ đã thay</h2>
          <DocumentTable documents={standing.history} entityId={entity.id} current={false} />
        </section>
      )}

      <EntityProfile
        entity={entity}
        email={actor.email}
        identifier={entity.kind === "household" ? <RevealPersonalId entityId={entity.id} masked={entity.identifier} /> : undefined}
      >
        <details className="mt-4 border-t pt-4">
          <summary className="cursor-pointer text-sm font-medium text-brand">Sửa thông tin tổ chức</summary>
          <div className="mt-4">
            <EntityForm entity={entity} wards={wards} />
          </div>
        </details>
      </EntityProfile>
    </div>
  );
}
