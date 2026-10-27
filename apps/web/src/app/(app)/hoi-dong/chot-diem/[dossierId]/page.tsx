import { Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { AggregateTable, formatPoints } from "@/components/scoring/aggregate-table";
import { formatIsoDate, formatVnDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { FinalizeButton } from "./finalize-button";
import { ReturnPanel } from "./return-panel";

export const dynamic = "force-dynamic";

/**
 * S43 Tổng hợp điểm và chốt (L15 HD-04, HD-05, HD-08; stories 98 to 101, 116 to 119): the phiếu đã xác nhận of each
 * thành viên chấm side by side with the điểm tổng hợp, the Hạng sao and the Cờ chênh lệch, and the Chốt điểm button
 * once the hồ sơ is Sẵn sàng chốt in an open Phiên họp. Before Sẵn sàng chốt the read model gives the phiếu đã xác nhận
 * without tổng hợp (#68), so the page says how many are still missing; after chốt a lock banner names who chốt and when,
 * and the table is the kết quả.
 */
export default async function AggregatePage({ params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  const [dossier, scores] = await Promise.all([
    app().core.dossiers.get(actor, { dossierId }).catch(orNotFound),
    app().core.scoring.readDossierScores(actor, { dossierId }).catch(orNotFound),
  ]);
  if (!dossier || !scores || (scores.kind !== "full" && scores.kind !== "confirmed_sheets")) notFound();
  const [meeting, history, results, readyDossiers] = await Promise.all([
    scores.kind === "full" && !scores.result ? app().core.scoring.meetingOf(actor, { dossierId }) : null,
    app().core.scoring.scoreSheetHistory(actor, { dossierId }),
    app().core.scoring.finalizedResults(actor, { dossierId }),
    // Ids only, for Hồ sơ trước sau: the list, not gradingProgress, which computes every aggregate.
    app().core.dossiers.list(actor, { state: "member_confirmed" }),
  ]);
  // L15 Mở khóa sau chốt (#63, story 130): earlier kết quả chốt, superseded, with the request that superseded them.
  const superseded = results.filter((r) => r.supersededAt !== null);
  const ready = readyDossiers.map((d) => d.id);
  const at = ready.indexOf(dossierId);
  const prev = at > 0 ? ready[at - 1] : undefined;
  const next = at >= 0 && at < ready.length - 1 ? ready[at + 1] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/hoi-dong/chot-diem" className="text-sm text-brand">
            ← Tổng hợp điểm
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-xl font-semibold">
            {dossier.productName || "Hồ sơ chưa đặt tên sản phẩm"} <DossierStateTag state={dossier.state} />
          </h1>
          <p className="text-sm text-text-2">
            Mã hồ sơ <b className="font-mono">{dossier.code}</b> · {dossier.entity.name} · Bộ tiêu chí{" "}
            {dossier.criteriaSet.code && `${dossier.criteriaSet.code} · `}
            {dossier.criteriaSet.name}
            {dossier.round && ` · ${dossier.round.name}`}
          </p>
        </div>
        {at >= 0 && (
          <nav className="flex gap-2 text-sm" aria-label="Hồ sơ trước sau">
            {prev ? (
              <Link href={`/hoi-dong/chot-diem/${prev}`} className="rounded-md border px-3 py-1.5">
                ← Hồ sơ trước
              </Link>
            ) : null}
            {next ? (
              <Link href={`/hoi-dong/chot-diem/${next}`} className="rounded-md border px-3 py-1.5">
                Hồ sơ sau →
              </Link>
            ) : null}
          </nav>
        )}
      </div>

      {scores.kind === "full" && scores.result && (
        <section role="status" className="flex flex-col gap-1 rounded-lg border border-line-strong bg-surface-2 px-4 py-3 text-sm" data-testid="finalized">
          <p className="flex items-center gap-2 font-medium">
            <Lock className="size-4" aria-hidden /> Đã chốt điểm{scores.result.n > 1 && ` (lần ${scores.result.n})`}: {scores.aggregate.star} sao,{" "}
            {formatPoints(scores.aggregate.total)} điểm
          </p>
          <p className="text-text-2">
            {scores.result.finalizedBy.fullName} chốt lúc {formatVnDateTime(scores.result.finalizedAt)}, xác thực lại bằng{" "}
            {scores.result.reauthMethod === "totp" ? "mã TOTP" : "mật khẩu"}. Điểm đã khóa, không sửa được trên giao diện.
          </p>
          {scores.result.absent.length > 0 && <p className="text-text-2">Vắng: {scores.result.absent.map((a) => a.fullName).join(", ")}.</p>}
          <p className="font-mono text-xs break-all text-text-3">SHA-256 {scores.result.sha256}</p>
        </section>
      )}
      {scores.kind === "full" && !scores.result && scores.dossierState === "member_confirmed" && (
        <section className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-surface px-4 py-3 shadow-card">
          <p className="text-sm text-text-2">
            {meeting ? (
              <>
                Thuộc Phiên họp{" "}
                <Link href={`/hoi-dong/van-ban/${meeting.id}`} className="text-brand">
                  {meeting.title}
                </Link>{" "}
                ngày {formatIsoDate(meeting.heldOn)} tại {meeting.location}.
              </>
            ) : (
              <>
                Hồ sơ chưa thuộc Phiên họp nào đang mở.{" "}
                <Link href="/hoi-dong/van-ban" className="text-brand">
                  Lập hoặc chọn Phiên họp
                </Link>
                .
              </>
            )}
          </p>
          <FinalizeButton
            dossierId={dossierId}
            version={scores.dossierVersion}
            star={scores.aggregate.star}
            total={formatPoints(scores.aggregate.total)}
            blockedReason={meeting ? null : "Thêm hồ sơ vào một Phiên họp đang mở trước khi chốt."}
          />
        </section>
      )}
      {scores.kind === "confirmed_sheets" && (
        <p role="status" className="rounded-lg border border-amber bg-amber-soft px-4 py-3 text-sm" data-testid="not-ready">
          Chưa đủ phiếu: {scores.graders.filter((g) => g.state === "confirmed").length} / {scores.minGraders} phiếu đã xác nhận. Bảng hiện điểm các phiếu đã xác
          nhận; điểm tổng hợp, hạng sao và cờ chênh lệch tính khi hồ sơ Sẵn sàng chốt.
        </p>
      )}
      <AggregateTable view={scores} />

      {superseded.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-amber bg-amber-soft px-4 py-3 text-sm" data-testid="superseded-results">
          <h2 className="font-medium">Kết quả chốt bị thay thế sau Mở khóa</h2>
          <ul className="flex flex-col gap-1">
            {superseded.map((r) => (
              <li key={r.id}>
                Lần {r.n}: {r.star} sao, {formatPoints(r.total)} điểm, chốt lúc {formatVnDateTime(r.finalizedAt)}.
                {r.unlock && ` Mở khóa lúc ${formatVnDateTime(r.unlock.unlockedAt)} theo yêu cầu của ${r.unlock.requestedBy}: ${r.unlock.reason}`}
                <span className="block font-mono text-xs break-all text-text-3">SHA-256 {r.sha256}</span>
              </li>
            ))}
          </ul>
          {dossier.state !== "score_finalized" && (
            <p className="text-text-2">Trả phiếu cho người cần chấm lại, rồi thêm hồ sơ vào một Phiên họp mới để chốt lại.</p>
          )}
        </section>
      )}
      {(dossier.state === "member_review" || dossier.state === "member_confirmed") && (
        <ReturnPanel dossierId={dossierId} graders={scores.graders} history={history} />
      )}
    </div>
  );
}
