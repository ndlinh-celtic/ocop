import { can, CHECKLIST_RESULT_LABEL, ENTITY_KIND_LABEL, maskPersonalId } from "@ocop/core";
import { FileDown } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { RefreshWhileScanning } from "@/components/refresh-while-scanning";
import { SignedWardReport } from "@/components/dossiers/signed-ward-report";
import { formatVnDate, formatVnDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { ForwardButton, SignedReportUploader } from "./forward-controls";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

/**
 * S25 Báo cáo đánh giá cấp xã và gửi lên tỉnh (L06 XA-07, stories 64 to 67): a preview of the report
 * generated from the newest Phiên bản nộp and the Checklist sơ bộ, the Word download, the upload of the
 * signed PDF and "Gửi lên tỉnh", locked with its reason until every condition holds. One report per hồ sơ.
 */
export default async function ForwardPage({ params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  const [dossier, status, checklist, submissions, timeline] = await Promise.all([
    app().core.dossiers.get(actor, { dossierId }).catch(orNotFound),
    app().core.dossiers.wardReport(actor, { dossierId }).catch(orNotFound),
    app().core.dossiers.checklist(actor, { dossierId }).catch(orNotFound),
    app().core.dossiers.submissions(actor, { dossierId }).catch(orNotFound),
    app().core.dossiers.timeline(actor, { dossierId }).catch(orNotFound),
  ]);
  if (!dossier || !status || !checklist || !submissions || !timeline) notFound();
  const latest = submissions.at(-1);
  if (!latest || !dossier.receivedAt) notFound();
  const round = dossier.roundId ? await app().core.rounds.getRound(actor, { roundId: dossier.roundId }).catch(orNotFound) : null;
  const ward = (await app().core.org.listWards()).find((w) => w.id === latest.wardId);
  const snapshot = latest.snapshot;
  const forwarded = timeline.findLast((e) => e.action === "dossier.forward");
  const canForward = can(actor, "dossier.forward", dossier);
  const daysLeft = status.forwardingDeadline ? Math.ceil((status.forwardingDeadline.getTime() - Date.now()) / DAY_MS) : null;
  const blockedReason = !status.signed?.current
    ? "Chưa tải lên Báo cáo đánh giá cấp xã đã ký cho Phiên bản nộp mới nhất."
    : status.signed.status === "blocked"
      ? "Bản đã ký bị chặn vì không an toàn, hãy tải lên bản khác."
      : status.signed.status !== "clean"
        ? "Bản đã ký đang được quét virus."
        : !status.checklistComplete
          ? "Checklist sơ bộ chưa được đánh giá đủ các mục."
          : status.pastForwardingDeadline
            ? "Đã quá Hạn gửi tỉnh của đợt: hồ sơ chờ đợt sau."
            : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/xa/ho-so/${dossier.id}`} className="text-sm text-brand">
          ← Chi tiết hồ sơ
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-xl font-semibold">
          Báo cáo đánh giá cấp xã và gửi lên tỉnh <DossierStateTag state={dossier.state} />
          {canForward && status.pastForwardingDeadline && (
            <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-medium text-amber">Chờ đợt sau</span>
          )}
        </h1>
        <p className="text-sm text-text-2">
          {dossier.productName || "Hồ sơ chưa đặt tên sản phẩm"} · {dossier.entity.name}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-label="Xem trước báo cáo" className="rounded-lg border bg-surface p-6 text-sm shadow-card">
          <p className="font-semibold">UBND {ward?.name ?? "xã/phường"}</p>
          <h2 className="mt-2 text-center text-base font-bold">BÁO CÁO ĐÁNH GIÁ CẤP XÃ</h2>
          <p className="mb-4 text-center text-text-3">Về kết quả đánh giá sơ bộ sản phẩm tham gia đánh giá, phân hạng sản phẩm OCOP</p>
          <p className="text-text-3">Thời gian, địa điểm, thành phần tham gia: để trống, điền tay trên bản in.</p>
          <h3 className="mt-4 font-semibold">I. Thông tin chủ thể và sản phẩm</h3>
          <dl className="mt-2 grid gap-1 sm:grid-cols-[10rem_1fr]">
            <dt className="text-text-3">Đợt đánh giá</dt>
            <dd>{round?.name ?? "—"}</dd>
            <dt className="text-text-3">Tên chủ thể</dt>
            <dd>
              {snapshot.entity.name} ({ENTITY_KIND_LABEL[snapshot.entity.kind]})
            </dd>
            <dt className="text-text-3">Mã số</dt>
            <dd>{snapshot.entity.taxCode ?? (snapshot.entity.personalIdLast4 ? maskPersonalId(snapshot.entity.personalIdLast4) : "—")}</dd>
            <dt className="text-text-3">Tên sản phẩm</dt>
            <dd>{snapshot.product.productName}</dd>
            <dt className="text-text-3">Bộ tiêu chí</dt>
            <dd>
              {snapshot.criteriaSet.code} {snapshot.criteriaSet.name}
            </dd>
            <dt className="text-text-3">Phiên bản nộp</dt>
            <dd>
              Số {latest.number}, nộp lúc {formatVnDateTime(latest.submittedAt)}
            </dd>
            <dt className="text-text-3">Tự chấm (tham khảo)</dt>
            <dd>
              {snapshot.selfScore.total} điểm, {snapshot.selfScore.star} sao
            </dd>
          </dl>
          <h3 className="mt-4 font-semibold">II. Kết quả đánh giá sơ bộ</h3>
          <table className="mt-2 w-full text-left">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-2 py-1">STT</th>
                <th className="px-2 py-1">Nội dung kiểm tra</th>
                <th className="px-2 py-1">Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {checklist.items.map((item, n) => (
                <tr key={item.code} className="border-b last:border-0">
                  <td className="px-2 py-1">{n + 1}</td>
                  <td className="px-2 py-1">{item.label}</td>
                  <td className="px-2 py-1">{item.result ? CHECKLIST_RESULT_LABEL[item.result] : <span className="text-amber">Chưa đánh giá</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 font-semibold">Đề xuất: {checklist.suggestion === "eligible" ? "Đủ điều kiện chuyển tỉnh" : "Chưa đủ điều kiện chuyển tỉnh"}</p>
          <p className="mt-2 text-text-3">Nhận xét Checklist sơ bộ không in vào báo cáo. Ý kiến của Chủ thể: để trống, điền tay trên bản in.</p>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border bg-surface p-4 text-sm shadow-card">
            <h2 className="font-semibold">Đợt {round?.name ?? ""}</h2>
            {status.forwardingDeadline && (
              <p className={status.pastForwardingDeadline ? "text-danger" : ""}>
                Hạn gửi tỉnh: {formatVnDate(status.forwardingDeadline)}
                {daysLeft !== null && !status.pastForwardingDeadline && ` (còn ${Math.max(daysLeft, 0)} ngày)`}
                {status.pastForwardingDeadline && " (đã quá hạn)"}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-lg border bg-surface p-4 text-sm shadow-card">
            {canForward && (
              <a
                href={`/xa/ho-so/${dossier.id}/gui-tinh/bao-cao.docx`}
                className="inline-flex w-fit items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 font-semibold"
              >
                <FileDown className="size-4" aria-hidden /> Tải bản nháp (Word)
              </a>
            )}
            {status.signed ? (
              <>
                <SignedWardReport dossierId={dossier.id} signed={status.signed} />
                {!status.signed.current && (
                  <p className="text-amber">Bản đã ký thuộc Phiên bản nộp cũ; hãy lập và ký lại theo Phiên bản nộp {latest.number}.</p>
                )}
                <RefreshWhileScanning active={status.signed.status === "scanning"} />
              </>
            ) : (
              <p className="text-text-3">Chưa có bản đã ký.</p>
            )}
            {can(actor, "dossier.ward_report.attach", dossier) && (
              <SignedReportUploader dossierId={dossier.id} version={dossier.version} replacing={status.signed !== null} />
            )}
          </section>

          <section className="rounded-lg border bg-surface p-4 text-sm shadow-card">
            {canForward ? (
              <ForwardButton
                dossierId={dossier.id}
                version={dossier.version}
                blockedReason={blockedReason}
                productName={dossier.productName}
                roundName={round?.name ?? ""}
              />
            ) : forwarded ? (
              <p>Đã gửi lên tỉnh lúc {formatVnDateTime(forwarded.occurredAt)}.</p>
            ) : (
              <p className="text-text-3">Hồ sơ không ở trạng thái gửi tỉnh được.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
