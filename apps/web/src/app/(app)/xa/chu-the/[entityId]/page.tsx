import { can, onBehalfOf } from "@ocop/core";
import { BadgeCheck, CircleAlert, UserCog } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntityProfile } from "@/components/entities/entity-profile";
import { DocumentTable, REQUIREMENT_STATE, RequirementList } from "@/components/entities/legal-documents";
import { RevealPersonalId } from "@/components/entities/reveal-personal-id";
import { dossierHome } from "@/lib/dossier-paths";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { ChangeEmailForm } from "./change-email-form";

export const dynamic = "force-dynamic";

/**
 * L01 (stories 12, 14, 44): a Chủ thể đăng ký ở xã của Cán bộ xã, with its hồ sơ pháp lý. A Chủ thể of
 * another xã is not found, as is one that does not exist.
 */
export default async function WardEntityPage({ params, searchParams }: { params: Promise<{ entityId: string }>; searchParams: Promise<{ moi?: string }> }) {
  const actor = await requireActor();
  const { entityId } = await params;
  const { moi } = await searchParams;
  const [entity, standing] = await Promise.all([
    app().core.entities.getEntity(actor, { entityId }).catch(orNotFound),
    app().core.entities.getLegalStanding(actor, { entityId }).catch(orNotFound),
  ]);
  if (!entity || !standing) notFound();
  const missing = standing.requirements.filter((r) => r.required && r.state !== "valid");
  const representative = entity.representativeEmail ? `${entity.representativeEmail}${entity.representativeActivated ? "" : " (chưa kích hoạt)"}` : "—";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/xa/chu-the" className="text-sm text-brand">
          ← Chủ thể của xã
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{entity.name}</h1>
          {/* L01 Nhập hộ: only for a Chủ thể đăng ký ở xã mình (story 75). */}
          {entity.ward.id === actor.activeScope?.id && can(onBehalfOf(actor, entity.id), "dossier.read") && (
            <Link href={dossierHome(entity.id)} className="flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium">
              <UserCog className="size-4" aria-hidden /> Nhập hộ hồ sơ
            </Link>
          )}
        </div>
      </div>

      {moi && (
        <p role="status" className="rounded-lg bg-brand-soft p-4 text-sm">
          Đã tạo Chủ thể. Liên kết kích hoạt đã được gửi tới <b>{entity.representativeEmail}</b>; người đại diện mở email để tự đặt mật khẩu.
        </p>
      )}

      {standing.verified ? (
        <div role="status" data-testid="verified" className="flex items-start gap-3 rounded-lg bg-brand-soft p-4 text-sm">
          <BadgeCheck className="size-5 shrink-0 text-brand" aria-hidden />
          <p>
            <b>Đã xác thực.</b> Có đủ giấy tờ bắt buộc còn hiệu lực. Tính hợp lệ của giấy tờ vẫn cần kiểm tra khi tiếp nhận từng hồ sơ.
          </p>
        </div>
      ) : (
        <div role="status" data-testid="not-verified" className="flex items-start gap-3 rounded-lg bg-amber-soft p-4 text-sm">
          <CircleAlert className="size-5 shrink-0 text-amber" aria-hidden />
          <div>
            <b>Chưa xác thực.</b> Còn thiếu giấy tờ bắt buộc còn hiệu lực:
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

      <EntityProfile
        entity={entity}
        email={representative}
        identifier={entity.kind === "household" ? <RevealPersonalId entityId={entity.id} masked={entity.identifier} /> : undefined}
      >
        {can(actor, "entity.representative_email.change") && (
          <details className="mt-4 border-t pt-4">
            <summary className="cursor-pointer text-sm font-medium text-brand">Đổi email người đại diện</summary>
            <div className="mt-4 max-w-md">
              <ChangeEmailForm entityId={entity.id} />
            </div>
          </details>
        )}
      </EntityProfile>

      <RequirementList standing={standing} />

      <section className="rounded-lg border bg-surface shadow-card">
        <h2 className="border-b p-4 font-semibold">Giấy tờ hiện có</h2>
        {standing.documents.length > 0 ? (
          <DocumentTable documents={standing.documents} entityId={entity.id} current />
        ) : (
          <p className="px-4 py-6 text-center text-sm text-text-3">Chủ thể chưa tải lên giấy tờ nào.</p>
        )}
      </section>

      {standing.history.length > 0 && (
        <section className="rounded-lg border bg-surface shadow-card">
          <h2 className="border-b p-4 font-semibold">Lịch sử giấy tờ đã thay</h2>
          <DocumentTable documents={standing.history} entityId={entity.id} current={false} />
        </section>
      )}
    </div>
  );
}
