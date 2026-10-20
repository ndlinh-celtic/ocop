import { can, ENTITY_KIND_LABEL, isExpired, maskPersonalId, PRODUCT_FIELD_LABEL, PRODUCT_FIELDS } from "@ocop/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DossierFlags } from "@/components/dossiers/dossier-flags";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { DossierTimeline } from "@/components/dossiers/dossier-timeline";
import { RejectionNotice } from "@/components/dossiers/rejection-notice";
import { SubmissionDocuments } from "@/components/dossiers/submission-documents";
import { formatIsoDate, formatVnDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { ChangeHandlerForm, ReceiveForm } from "./handler-forms";
import { RejectForm, TransferWardForm } from "./reject-transfer-forms";

export const dynamic = "force-dynamic";

/**
 * S21 Chi tiết hồ sơ tại xã (L05 XA-01 to XA-03, stories 40 to 46): the newest Phiên bản nộp with the
 * Chủ thể and its giấy tờ as they were at nộp, what changed since, Tiêu chí without minh chứng, Tiếp
 * nhận and Cán bộ phụ trách. A hồ sơ of another xã is not found, as is one that does not exist.
 */
export default async function WardDossierPage({ params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  const [dossier, timeline, submissions, officers] = await Promise.all([
    app().core.dossiers.get(actor, { dossierId }).catch(orNotFound),
    app().core.dossiers.timeline(actor, { dossierId }).catch(orNotFound),
    app().core.dossiers.submissions(actor, { dossierId }).catch(orNotFound),
    app().core.dossiers.handlers(actor),
  ]);
  if (!dossier || !timeline || !submissions) notFound();
  const latest = submissions.at(-1);
  const snapshot = latest?.snapshot;
  const names = new Map(officers.map((o) => [o.userId, o.fullName]));
  // Officers who left the xã still appear by name on the timeline when they were the Cán bộ phụ trách.
  if (dossier.handler) names.set(dossier.handler.userId, dossier.handler.fullName);
  // L05 XA-06 and Chuyển xã (stories 47, 63): what loại may cite, and where the hồ sơ may go.
  const rejectable = can(actor, "dossier.reject", dossier);
  const transferable = can(actor, "dossier.ward_transfer", dossier);
  const [exclusions, wards] = await Promise.all([
    rejectable ? app().core.criteria.getCriteriaSet(actor, { setId: dossier.criteriaSet.id }).then((v) => v.set.exclusionConditions) : [],
    transferable ? app().core.org.listWards().then((all) => all.filter((w) => w.id !== dossier.wardId)) : [],
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/xa/ho-so" className="text-sm text-brand">
          ← Hồ sơ tại xã
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-xl font-semibold">
          {dossier.productName || "Hồ sơ chưa đặt tên sản phẩm"} <DossierStateTag state={dossier.state} />
        </h1>
        <p className="text-sm text-text-2">
          <Link href={`/xa/chu-the/${dossier.entity.id}`} className="text-brand underline-offset-2 hover:underline">
            {dossier.entity.name}
          </Link>{" "}
          · Bộ tiêu chí {dossier.criteriaSet.code && `${dossier.criteriaSet.code} · `}
          {dossier.criteriaSet.name}, căn cứ {dossier.criteriaVersion.legalBasis}
        </p>
      </div>

      <section className="rounded-lg border bg-surface p-4 text-sm shadow-card">
        {latest && (
          <>
            <p>
              Phiên bản nộp {latest.number}, nộp lúc {formatVnDateTime(latest.submittedAt)}.
            </p>
            <SubmissionDocuments dossierId={dossier.id} submissionNumber={latest.number} />
          </>
        )}
        {dossier.receivedAt ? (
          <p>
            Đã tiếp nhận lúc {formatVnDateTime(dossier.receivedAt)}
            {dossier.receivedBy && names.get(dossier.receivedBy) ? ` bởi ${names.get(dossier.receivedBy)}` : ""}. Cán bộ phụ trách:{" "}
            <b>{dossier.handler?.fullName ?? "—"}</b>.
          </p>
        ) : (
          dossier.state === "submitted_to_ward" && <p className="font-medium text-amber">Chờ tiếp nhận.</p>
        )}
        <DossierFlags flags={dossier.flags} />
      </section>

      {dossier.rejection && <RejectionNotice rejection={dossier.rejection} />}

      {can(actor, "dossier.receive", dossier) && !dossier.receivedAt && (
        <ReceiveForm dossierId={dossier.id} version={dossier.version} officers={officers} me={actor.userId} />
      )}
      {can(actor, "dossier.handler.change", dossier) && dossier.receivedAt && (
        <section className="rounded-lg border bg-surface p-4 shadow-card">
          <h2 className="mb-3 font-semibold">Cán bộ phụ trách</h2>
          <ChangeHandlerForm dossierId={dossier.id} version={dossier.version} officers={officers} current={dossier.handlerUserId} />
        </section>
      )}

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
            <h2 className="mb-1 font-semibold">Chủ thể tại lúc nộp</h2>
            <p className="mb-3 text-sm text-text-3">
              Bản chụp trong Phiên bản nộp.{" "}
              <Link href={`/xa/chu-the/${dossier.entity.id}`} className="text-brand underline-offset-2 hover:underline">
                Xem hồ sơ pháp lý hiện tại
              </Link>
            </p>
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
            <h2 className="border-b p-4 font-semibold">Giấy tờ pháp lý tại lúc nộp</h2>
            {snapshot.legalDocuments.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-text-3">Không có giấy tờ nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-surface-2">
                    <tr>
                      <th className="px-4 py-2">Loại giấy tờ</th>
                      <th className="px-4 py-2">Số</th>
                      <th className="px-4 py-2">Ngày cấp</th>
                      <th className="px-4 py-2">Hiệu lực đến</th>
                      <th className="px-4 py-2">Khi nộp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.legalDocuments.map((d) => (
                      <tr key={d.id} className="border-b last:border-0">
                        <td className="px-4 py-2">{d.typeName}</td>
                        <td className="px-4 py-2">{d.documentNumber ?? "—"}</td>
                        <td className="px-4 py-2">{formatIsoDate(d.issuedOn)}</td>
                        <td className="px-4 py-2">{d.validUntil ? formatIsoDate(d.validUntil) : "Không thời hạn"}</td>
                        <td className="px-4 py-2">
                          {isExpired(d, latest.submittedAt) ? <span className="text-danger">Đã hết hạn</span> : <span className="text-brand">Còn hạn</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-lg border bg-surface shadow-card">
            <h2 className="border-b p-4 font-semibold">
              Tự chấm và minh chứng · {snapshot.selfScore.total} điểm, ước lượng {snapshot.selfScore.star} sao
            </h2>
            {dossier.criteriaWithoutEvidence.length > 0 && (
              <p role="status" className="border-b bg-amber-soft px-4 py-2 text-sm text-amber">
                {dossier.criteriaWithoutEvidence.length} tiêu chí chưa có minh chứng: {dossier.criteriaWithoutEvidence.map((c) => c.code).join(", ")}.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-surface-2">
                  <tr>
                    <th className="px-4 py-2">Tiêu chí</th>
                    <th className="px-4 py-2">Điểm tự chấm</th>
                    <th className="px-4 py-2">Giải trình</th>
                    <th className="px-4 py-2">Minh chứng</th>
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
                      <td className="px-4 py-2">
                        {c.evidenceFileIds.length === 0 ? (
                          <span className="text-amber">Chưa có</span>
                        ) : (
                          snapshot.evidence
                            .filter((e) => c.evidenceFileIds.includes(e.fileId))
                            .map((e) => e.fileName)
                            .join(", ")
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {rejectable && <RejectForm dossierId={dossier.id} version={dossier.version} exclusions={exclusions} />}
      {transferable && <TransferWardForm dossierId={dossier.id} version={dossier.version} wards={wards} />}

      <DossierTimeline events={timeline} names={names} />
    </div>
  );
}
