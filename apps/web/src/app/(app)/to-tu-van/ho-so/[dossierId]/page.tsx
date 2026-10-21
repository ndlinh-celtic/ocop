import { CHECKLIST_RESULT_LABEL, PRODUCT_FIELD_LABEL, PRODUCT_FIELDS } from "@ocop/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadButton } from "@/components/download-button";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { SignedWardReport } from "@/components/dossiers/signed-ward-report";
import { SubmissionDocuments } from "@/components/dossiers/submission-documents";
import { downloadAdvisoryFileAction } from "@/components/scoring/actions";
import { formatPoints } from "@/components/scoring/aggregate-table";
import { formatVnDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { AdvisoryEditor } from "./advisory-editor";

export const dynamic = "force-dynamic";

/**
 * S51 Thẩm định và chấm điểm đề xuất (L10 TM-01, TM-02, TM-05, TM-06; #56 stories 43 to 50): on the left what
 * the Tổ tư vấn reviews (the newest Phiên bản nộp with its văn bản, minh chứng by Tiêu chí, the signed Báo cáo
 * đánh giá cấp xã and the Checklist sơ bộ); on the right the shared nháp, editable while Tổ tư vấn thẩm định. A
 * hồ sơ the reader is not Phân công on as Thành viên Tổ tư vấn is not found.
 */
export default async function AdvisoryReviewPage({ params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  const [dossier, ws, submissions, checklist] = await Promise.all([
    app().core.dossiers.get(actor, { dossierId }).catch(orNotFound),
    app().core.scoring.advisoryReport(actor, { dossierId }).catch(orNotFound),
    app().core.dossiers.submissions(actor, { dossierId }).catch(orNotFound),
    app().core.dossiers.checklist(actor, { dossierId }).catch(orNotFound),
  ]);
  if (!dossier || !ws || !submissions || !checklist) notFound();
  const wardReport = await app().core.dossiers.wardReport(actor, { dossierId });
  const latest = submissions.at(-1);
  const download = downloadAdvisoryFileAction.bind(null, dossierId);
  const editable = ws.state === "advisory_review";
  // Story 123 (#60): after chốt, the kết quả without any thành viên's phiếu.
  const scores = await app().core.scoring.readDossierScores(actor, { dossierId });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/to-tu-van/hang-doi" className="text-sm text-brand">
          ← Hàng đợi thẩm định
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-xl font-semibold">
          {dossier.productName || "Hồ sơ chưa đặt tên sản phẩm"} <DossierStateTag state={dossier.state} />
        </h1>
        <p className="text-sm text-text-2">
          Mã hồ sơ <b className="font-mono">{dossier.code}</b> · {dossier.entity.name} · Bộ tiêu chí {dossier.criteriaSet.code && `${dossier.criteriaSet.code} · `}
          {dossier.criteriaSet.name}
        </p>
        <p className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link href={`/to-tu-van/ho-so/${dossierId}/bao-cao`} className="font-semibold text-brand">
            Soạn và phát hành báo cáo (S52) →
          </Link>
          {ws.versions.length > 0 && <span className="text-text-2">Đã phát hành {ws.versions.length} phiên bản.</span>}
        </p>
      </div>
      {scores.kind === "aggregate_only" && (
        <section role="status" className="rounded-lg border border-line-strong bg-surface-2 px-4 py-3 text-sm" data-testid="advisory-final-result">
          <p className="font-medium">
            Hội đồng đã chốt điểm: {scores.aggregate.star} sao, {formatPoints(scores.aggregate.total)} điểm ({scores.aggregate.parts.map((p) => `Phần ${p.code} ${formatPoints(p.total)}`).join(", ")}).
          </p>
          <p className="text-text-2">Chốt lúc {formatVnDateTime(scores.result.finalizedAt)}.</p>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2 rounded-lg border bg-surface p-4 text-sm shadow-card">
            <h2 className="font-semibold">Thông tin hồ sơ</h2>
            {latest ? (
              <>
                <p>
                  Phiên bản nộp {latest.number}, nộp lúc {formatVnDateTime(latest.submittedAt)}.
                </p>
                <SubmissionDocuments dossierId={dossierId} submissionNumber={latest.number} />
                <dl className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                  {PRODUCT_FIELDS.map((field) => (
                    <div key={field} className="contents">
                      <dt className="text-text-3">{PRODUCT_FIELD_LABEL[field]}</dt>
                      <dd className="whitespace-pre-line">{latest.snapshot.product[field] || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="text-text-3">Chưa có Phiên bản nộp.</p>
            )}
          </section>

          <section className="flex flex-col gap-2 rounded-lg border bg-surface p-4 text-sm shadow-card">
            <h2 className="font-semibold">Báo cáo đánh giá cấp xã và Checklist sơ bộ</h2>
            {wardReport.signed ? <SignedWardReport dossierId={dossierId} signed={wardReport.signed} /> : <p className="text-text-3">Chưa có Báo cáo đánh giá cấp xã đã ký.</p>}
            <ul className="flex flex-col gap-1">
              {checklist.items.map((item) => (
                <li key={item.code} className="flex flex-wrap gap-2">
                  <span>{item.label}:</span>
                  <b className={item.result === "pass" ? "text-brand" : "text-amber"}>{item.result ? CHECKLIST_RESULT_LABEL[item.result] : "Chưa đánh giá"}</b>
                  {item.comment && <span className="text-text-3">({item.comment})</span>}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border bg-surface shadow-card">
            <h2 className="border-b p-4 font-semibold">Minh chứng theo tiêu chí</h2>
            <ul className="flex flex-col divide-y text-sm">
              {ws.criteria.map((c) => (
                <li key={c.criterionId} className="flex flex-col gap-1 p-4">
                  <p>
                    <b>{c.code}</b> {c.name} · tự chấm {c.submitted.points ?? "—"}
                  </p>
                  {c.submitted.explanation && <p className="whitespace-pre-line text-text-2">Giải trình: {c.submitted.explanation}</p>}
                  {c.submitted.evidence.length === 0 ? (
                    <p className="text-amber">Chưa có minh chứng.</p>
                  ) : (
                    c.submitted.evidence.map((e) => (
                      <div key={e.fileId} className="flex flex-wrap items-center gap-2">
                        <span>{e.fileName}</span>
                        <DownloadButton fileId={e.fileId} download={download} />
                      </div>
                    ))
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-2">
            Bản nháp chung của Tổ tư vấn
            {ws.updatedBy && ws.updatedAt && (
              <>
                , lưu lần cuối lúc {formatVnDateTime(ws.updatedAt)} bởi {ws.updatedBy.fullName}
              </>
            )}
            . Ước lượng đã lưu: {ws.estimate.total} điểm, {ws.estimate.star} sao.
          </p>
          {editable ? (
            <AdvisoryEditor
              key={ws.draftVersion}
              dossierId={dossierId}
              criteria={ws.criteria}
              summary={ws.summary}
              notes={ws.notes}
              attachments={ws.attachments}
              mode={{ kind: "draft", draftVersion: ws.draftVersion }}
            />
          ) : (
            <p role="status" className="rounded-lg border bg-surface p-4 text-sm shadow-card">
              Báo cáo đã được phát hành nên bản nháp không sửa được nữa. Sửa sau phát hành là phát hành phiên bản mới, ở trang soạn và phát hành báo cáo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
