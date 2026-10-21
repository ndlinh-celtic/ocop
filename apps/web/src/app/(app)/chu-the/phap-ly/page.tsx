import { BadgeCheck, CircleAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { EntityProfile } from "@/components/entities/entity-profile";
import { DocumentTable, REQUIREMENT_STATE, RequirementList } from "@/components/entities/legal-documents";
import { RefreshWhileScanning } from "@/components/refresh-while-scanning";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { EntityForm } from "./entity-form";
import { LegalDocumentForm } from "./legal-document-form";
import { ReplaceDocument } from "./replace-document";

export const dynamic = "force-dynamic";

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
                  {r.name} ({REQUIREMENT_STATE[r.state].label.toLowerCase()})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <RequirementList standing={standing} />

      <section className="rounded-lg border bg-surface shadow-card">
        <h2 className="border-b p-4 font-semibold">Giấy tờ hiện có</h2>
        {standing.documents.length > 0 ? (
          <DocumentTable documents={standing.documents} entityId={entity.id} current actions={(d) => <ReplaceDocument entityId={entity.id} document={d} />} />
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

      <EntityProfile entity={entity} email={actor.email}>
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
