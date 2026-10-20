import { can, ENTITY_KIND_LABEL, maskPersonalId, PRODUCT_FIELD_LABEL, PRODUCT_FIELDS, vnDateOf } from "@ocop/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { DossierTimeline } from "@/components/dossiers/dossier-timeline";
import { RejectionNotice } from "@/components/dossiers/rejection-notice";
import { ReturnRequests } from "@/components/dossiers/return-requests";
import { SignedWardReport } from "@/components/dossiers/signed-ward-report";
import { SubmissionDocuments } from "@/components/dossiers/submission-documents";
import { SupplementRequests } from "@/components/dossiers/supplement-requests";
import { formatVnDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { RequestSupplementForm } from "../../../xa/ho-so/[dossierId]/supplement-forms";
import { returnFromProvinceAction } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Chi tiết hồ sơ ở tỉnh (L04, L06, #44, stories 57, 59, 78): a hồ sơ that has reached the province, with
 * its newest Phiên bản nộp and generated văn bản, the signed Báo cáo đánh giá cấp xã, the đề nghị trả về of
 * the xã and the trả về itself while it is Đã chuyển tỉnh. A hồ sơ not yet at the province is not found,
 * as is one that does not exist (the notifications of gửi tỉnh link here).
 */
export default async function ProvinceDossierPage({ params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  const [dossier, timeline, submissions, supplements, returnRequests] = await Promise.all([
    app().core.dossiers.get(actor, { dossierId }).catch(orNotFound),
    app().core.dossiers.timeline(actor, { dossierId }).catch(orNotFound),
    app().core.dossiers.submissions(actor, { dossierId }).catch(orNotFound),
    app().core.dossiers.supplementRequests(actor, { dossierId }).catch(orNotFound),
    app().core.dossiers.returnRequests(actor, { dossierId }).catch(orNotFound),
  ]);
  if (!dossier || !timeline || !submissions || !supplements || !returnRequests) notFound();
  const wardReport = await app().core.dossiers.wardReport(actor, { dossierId });
  const latest = submissions.at(-1);
  const snapshot = latest?.snapshot;
  const mayReturn = can(actor, "dossier.province_return", dossier);
  const documentTypes = mayReturn ? (await app().core.entities.getLegalStanding(actor, { entityId: dossier.entity.id })).requirements : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/so/ho-so" className="text-sm text-brand">
          ← Hồ sơ toàn tỉnh
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-xl font-semibold">
          {dossier.productName || "Hồ sơ chưa đặt tên sản phẩm"} <DossierStateTag state={dossier.state} />
        </h1>
        <p className="text-sm text-text-2">
          {dossier.entity.name} · Bộ tiêu chí {dossier.criteriaSet.code && `${dossier.criteriaSet.code} · `}
          {dossier.criteriaSet.name}, căn cứ {dossier.criteriaVersion.legalBasis}
        </p>
      </div>

      <section className="flex flex-col gap-2 rounded-lg border bg-surface p-4 text-sm shadow-card">
        {dossier.firstForwardedAt && <p>Lên tỉnh lần đầu lúc {formatVnDateTime(dossier.firstForwardedAt)}.</p>}
        {latest && (
          <>
            <p>
              Phiên bản nộp {latest.number}, nộp lúc {formatVnDateTime(latest.submittedAt)}.
            </p>
            <SubmissionDocuments dossierId={dossier.id} submissionNumber={latest.number} />
          </>
        )}
        {wardReport.signed ? <SignedWardReport dossierId={dossier.id} signed={wardReport.signed} /> : <p className="text-text-3">Chưa có Báo cáo đánh giá cấp xã đã ký.</p>}
        {dossier.state === "supplement_requested" && dossier.supplementDeadline && (
          <p role="status" className="text-amber">
            Đang chờ Chủ thể bổ sung, hạn đến {formatVnDateTime(dossier.supplementDeadline)}. Sau khi nộp lại, hồ sơ về xã/phường xem lại và gửi tỉnh lại.
          </p>
        )}
      </section>

      {dossier.rejection && <RejectionNotice rejection={dossier.rejection} />}
      <ReturnRequests requests={returnRequests} />

      {mayReturn && snapshot && (
        <RequestSupplementForm
          dossierId={dossier.id}
          version={dossier.version}
          today={vnDateOf(new Date())}
          criteria={snapshot.criteria.map((c) => ({ id: c.criterionId, label: `${c.code} ${c.name}` }))}
          documentTypes={documentTypes.map((d) => ({ code: d.typeCode, name: d.name }))}
          submit={returnFromProvinceAction}
          title="Trả về để bổ sung"
          submitLabel="Trả hồ sơ về Yêu cầu bổ sung"
        />
      )}
      <SupplementRequests requests={supplements} />

      {snapshot && (
        <>
          <section className="rounded-lg border bg-surface p-4 shadow-card">
            <h2 className="mb-3 font-semibold">Thông tin sản phẩm</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-[12rem_1fr]">
              {PRODUCT_FIELDS.map((field) => (
                <div key={field} className="contents">
                  <dt className="text-text-3">{PRODUCT_FIELD_LABEL[field]}</dt>
                  <dd className="whitespace-pre-line">{snapshot.product[field] || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-lg border bg-surface p-4 shadow-card">
            <h2 className="mb-3 font-semibold">Chủ thể tại lúc nộp</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-[12rem_1fr]">
              <dt className="text-text-3">Tên</dt>
              <dd>{snapshot.entity.name}</dd>
              <dt className="text-text-3">Loại tổ chức</dt>
              <dd>{ENTITY_KIND_LABEL[snapshot.entity.kind]}</dd>
              <dt className="text-text-3">Định danh</dt>
              <dd>{snapshot.entity.taxCode ?? (snapshot.entity.personalIdLast4 ? maskPersonalId(snapshot.entity.personalIdLast4) : "—")}</dd>
              <dt className="text-text-3">Địa chỉ</dt>
              <dd>{snapshot.entity.address}</dd>
              <dt className="text-text-3">Người đại diện</dt>
              <dd>
                {snapshot.entity.representativeName} · {snapshot.entity.phone}
              </dd>
            </dl>
          </section>

          <section className="rounded-lg border bg-surface shadow-card">
            <h2 className="border-b p-4 font-semibold">
              Tự chấm · {snapshot.selfScore.total} điểm, ước lượng {snapshot.selfScore.star} sao
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-surface-2">
                  <tr>
                    <th className="px-4 py-2">Tiêu chí</th>
                    <th className="px-4 py-2">Điểm tự chấm</th>
                    <th className="px-4 py-2">Giải trình</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.criteria.map((c) => (
                    <tr key={c.criterionId} className="border-b align-top last:border-0">
                      <td className="px-4 py-2">
                        <b>{c.code}</b> {c.name}
                      </td>
                      <td className="px-4 py-2">{c.points}</td>
                      <td className="px-4 py-2 whitespace-pre-line">{c.explanation || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <DossierTimeline events={timeline} />
    </div>
  );
}
