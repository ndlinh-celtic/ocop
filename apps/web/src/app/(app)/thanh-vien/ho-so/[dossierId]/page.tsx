import Link from "next/link";
import { notFound } from "next/navigation";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { SubmissionDocuments } from "@/components/dossiers/submission-documents";
import { formatVnDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { ScoreSheetForm, type SubmittedCriterion } from "./score-sheet-form";

export const dynamic = "force-dynamic";

/**
 * S61 Phiếu chấm (L13, L14 TV-01, TV-05..07; stories 78 to 92, 94): the hồ sơ Giao chấm to the thành viên, its
 * newest Phiên bản nộp on the left (thông tin Chủ thể, read as an audited personal data access; giải trình and
 * minh chứng per Tiêu chí; the Word files), their own Phiếu chấm on the right. Nobody else's points appear here.
 * A hồ sơ without a Phân công of theirs in force is not found.
 */
export default async function ScoreSheetPage({ params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  const [dossier, scores, submissions] = await Promise.all([
    app().core.dossiers.get(actor, { dossierId }).catch(orNotFound),
    app().core.scoring.readDossierScores(actor, { dossierId, ownSheet: true }).catch(orNotFound),
    app().core.dossiers.submissions(actor, { dossierId }).catch(orNotFound),
  ]);
  if (!dossier || !scores || !submissions || scores.kind !== "own_sheet") notFound();
  const entity = await app().core.entities.getEntity(actor, { entityId: dossier.entity.id });
  const latest = submissions.at(-1);
  const submitted: Record<string, SubmittedCriterion> = Object.fromEntries(
    (latest?.snapshot.criteria ?? []).map((c) => [
      c.criterionId,
      {
        points: c.points,
        explanation: c.explanation,
        evidence: c.evidenceFileIds.map((id) => latest!.snapshot.evidence.find((e) => e.fileId === id)?.fileName ?? "Tệp"),
      },
    ]),
  );
  const awaitingCopy = scores.sheet?.state === "draft" && scores.sheet.awaitingCopy;
  const writable = scores.sheet?.state === "draft" && !awaitingCopy && (dossier.state === "member_review" || dossier.state === "member_confirmed");
  // S61: a phiên bản newer than any copied into the phiếu changes nothing in it until the Tổ tư vấn copies it.
  const versions = await app().core.scoring.advisoryReportVersions(actor, { dossierId });
  const copied = Math.max(0, ...scores.criteria.map((c) => c.advisory?.number ?? 0));
  const newer = copied > 0 && (versions.at(-1)?.number ?? 0) > copied ? versions.at(-1)!.number : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/thanh-vien/ho-so" className="text-sm text-brand">
          ← Hồ sơ được phân công
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-xl font-semibold">
          {dossier.productName || "Hồ sơ chưa đặt tên sản phẩm"} <DossierStateTag state={dossier.state} />
        </h1>
        <p className="text-sm text-text-2">
          Mã hồ sơ <b className="font-mono">{dossier.code}</b> · Bộ tiêu chí {dossier.criteriaSet.code && `${dossier.criteriaSet.code} · `}
          {dossier.criteriaSet.name}
          {dossier.round && ` · ${dossier.round.name}`}
        </p>
        <Link href={`/thanh-vien/ho-so/${dossier.id}/bao-cao-to-tu-van`} className="text-sm font-semibold text-brand">
          Báo cáo Tổ tư vấn đã phát hành →
        </Link>
      </div>

      {scores.sheet?.state === "draft" && scores.sheet.attempt > 1 && (
        <p role="status" className="rounded-lg border border-amber bg-amber-soft px-4 py-2 text-sm" data-testid="sheet-returned">
          Hội đồng đã Trả phiếu: đây là lần chấm {scores.sheet.attempt}, điền sẵn từ phiếu trước. Lý do có trong thông báo. Sửa phần cần rồi xác nhận lại.
        </p>
      )}
      {scores.sheet?.state === "confirmed" && (
        <p role="status" className="rounded-lg border border-brand bg-brand-soft px-4 py-2 text-sm text-brand" data-testid="sheet-locked">
          Phiếu đã xác nhận lúc {formatVnDateTime(scores.sheet.confirmedAt!)} và đã khóa. Muốn sửa phải có Trả phiếu của hội đồng.
        </p>
      )}
      {awaitingCopy && (
        <p role="status" className="rounded-lg border border-amber bg-amber-soft px-4 py-2 text-sm" data-testid="sheet-awaiting-copy">
          Anh/chị được bổ sung sau lần sao chép từ Tổ tư vấn. Phiếu này chờ lần sao chép tiếp theo; chấm được sau khi Tổ tư vấn sao chép báo cáo vào phiếu.
        </p>
      )}
      {newer !== null && scores.sheet?.state === "draft" && (
        <p role="status" className="rounded-lg border px-4 py-2 text-sm text-text-2" data-testid="newer-advisory-version">
          Có phiên bản {newer} của báo cáo Tổ tư vấn. Phiếu của anh/chị không bị thay đổi cho đến khi Tổ tư vấn sao chép phiên bản này.
        </p>
      )}
      {dossier.state === "advisory_review" || dossier.state === "advisory_report_issued" ? (
        <p role="status" className="rounded-lg border px-4 py-2 text-sm text-text-2">
          Hồ sơ đang được Tổ tư vấn thẩm định. Anh/chị xem được hồ sơ, và chấm được sau khi Tổ tư vấn sao chép báo cáo vào phiếu.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border bg-surface p-4 shadow-card">
            <h2 className="mb-2 font-semibold">Thông tin hồ sơ</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-text-3">Chủ thể</dt>
              <dd>{entity.name}</dd>
              <dt className="text-text-3">Địa chỉ</dt>
              <dd>{entity.address}</dd>
              <dt className="text-text-3">Người đại diện</dt>
              <dd>
                {entity.representativeName} · {entity.phone}
              </dd>
              <dt className="text-text-3">Nhóm</dt>
              <dd>{dossier.productGroup?.name ?? "—"}</dd>
              <dt className="text-text-3">Giao chấm</dt>
              <dd>{dossier.gradingStartedAt ? formatVnDateTime(dossier.gradingStartedAt) : "—"}</dd>
            </dl>
          </section>
          {latest && (
            <section className="rounded-lg border bg-surface p-4 shadow-card">
              <h2 className="mb-1 font-semibold">Phiên bản nộp số {latest.number}</h2>
              <p className="mb-3 text-sm text-text-2">
                Nộp lúc {formatVnDateTime(latest.submittedAt)}. Giải trình và minh chứng của Chủ thể hiện cạnh từng Tiêu chí của phiếu.
              </p>
              <SubmissionDocuments dossierId={dossier.id} submissionNumber={latest.number} />
            </section>
          )}
        </aside>

        <ScoreSheetForm view={scores} submitted={submitted} writable={writable} />
      </div>
    </div>
  );
}
