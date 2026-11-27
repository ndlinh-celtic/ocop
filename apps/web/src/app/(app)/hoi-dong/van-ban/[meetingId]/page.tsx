import { can, MEETING_DOCUMENT_KINDS, MEETING_DOCUMENT_LABEL } from "@ocop/core";
import { FileText, Flag, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { DownloadButton } from "@/components/download-button";
import { RefreshWhileScanning } from "@/components/refresh-while-scanning";
import { formatPoints } from "@/components/scoring/aggregate-table";
import { formatIsoDate, formatVnDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { AddDossiersForm, CloseMeetingButton, RemoveDossierButton } from "../meeting-forms";
import { downloadMinutesAction } from "./minutes-actions";
import { MinutesUploader } from "./minutes-uploader";

export const dynamic = "force-dynamic";

/**
 * S44 one Phiên họp (L15 HD-09; stories 107 to 109): its hồ sơ, chốt or still waiting, each opening S43 to chốt;
 * while open, the hồ sơ Sẵn sàng chốt of the đợt that may join it, gỡ for a hồ sơ not yet chốt, and Kết thúc once
 * none waits. Văn bản họp (#62, stories 110 to 115): the three DOCX sinh from the mẫu tạm, a bản nháp while a hồ sơ is
 * not chốt, and the biên bản đã ký số the Thư ký uploads.
 */
export default async function MeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const actor = await requireActor();
  const { meetingId } = await params;
  const meeting = await app().core.scoring.getMeeting(actor, { meetingId }).catch(orNotFound);
  if (!meeting) notFound();
  const open = meeting.state === "open";
  const waiting = meeting.dossierCount - meeting.finalizedCount - meeting.movedCount;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/hoi-dong/van-ban" className="text-sm text-brand">
            ← Phiên họp
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{meeting.title}</h1>
          <p className="text-sm text-text-2">
            {formatIsoDate(meeting.heldOn)} · {meeting.location} · {meeting.round.name} ·{" "}
            {open ? "Đang mở" : `Đã kết thúc${meeting.closedAt ? ` lúc ${formatVnDateTime(meeting.closedAt)}` : ""}`}
          </p>
        </div>
        {open && <CloseMeetingButton meetingId={meeting.id} pending={waiting} />}
      </div>

      <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface-2">
            <tr>
              <th className="px-3 py-2">Mã hồ sơ</th>
              <th className="px-3 py-2">Sản phẩm</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Kết quả chốt</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {meeting.dossiers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-text-3">
                  Phiên họp chưa có hồ sơ.
                </td>
              </tr>
            )}
            {meeting.dossiers.map((d) => (
              <tr key={d.dossierId} className="border-b last:border-0" data-testid="meeting-dossier">
                <td className="px-3 py-2 font-mono whitespace-nowrap">
                  <Link href={`/hoi-dong/chot-diem/${d.dossierId}`} className="text-brand">
                    {d.code}
                  </Link>
                </td>
                <td className="px-3 py-2">{d.productName || "(Chưa đặt tên sản phẩm)"}</td>
                <td className="px-3 py-2">
                  <DossierStateTag state={d.state} />
                </td>
                <td className="px-3 py-2">
                  {d.result ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <Lock className="size-4" aria-hidden /> {d.result.star} sao · {formatPoints(d.result.total)} điểm
                      {d.result.flagged && (
                        <span className="inline-flex items-center gap-1 text-danger">
                          <Flag className="size-4" aria-hidden /> Lệch điểm lớn
                        </span>
                      )}
                    </span>
                  ) : d.movedTo ? (
                    <span className="text-text-2" data-testid="moved-to">
                      Đã chốt lại tại phiên khác:{" "}
                      <Link href={`/hoi-dong/van-ban/${d.movedTo.id}`} className="text-brand">
                        {d.movedTo.title}
                      </Link>
                    </span>
                  ) : (
                    <span className="text-text-3">Chưa chốt</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {open && !d.result && !d.movedTo && <RemoveDossierButton meetingId={meeting.id} dossierId={d.dossierId} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {open && <AddDossiersForm meetingId={meeting.id} candidates={meeting.candidates} />}

      <section className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card" aria-labelledby="van-ban-hop">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="van-ban-hop" className="font-semibold">
            Văn bản họp
          </h2>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${waiting > 0 || meeting.dossiers.length === 0 ? "bg-surface-2 text-text-2" : "bg-brand/10 text-brand"}`}
          >
            {waiting > 0 || meeting.dossiers.length === 0 ? "Nháp" : "Số liệu đã chốt"}
          </span>
        </div>
        {waiting > 0 && (
          <p className="text-sm text-amber">
            Chưa chốt toàn bộ hồ sơ của Phiên họp: còn {waiting} hồ sơ, số liệu của chúng là tạm tính. Sinh lại sau khi chốt để có số liệu cuối.
          </p>
        )}
        <p className="text-xs text-text-3">
          Mẫu tạm theo cấu trúc QĐ 26/2026/QĐ-TTg, cần đối chiếu với mẫu chính thức. Dự thảo quyết định chỉ gồm hồ sơ từ 3 sao.
        </p>
        <ul className="flex flex-wrap gap-2">
          {MEETING_DOCUMENT_KINDS.map((kind) => (
            <li key={kind}>
              <a
                href={`/hoi-dong/van-ban/${meeting.id}/van-ban/${kind}`}
                className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-semibold"
              >
                <FileText className="size-4" aria-hidden /> {MEETING_DOCUMENT_LABEL[kind]} (Word)
              </a>
            </li>
          ))}
        </ul>

        <h3 className="mt-2 font-medium">Biên bản đã ký</h3>
        <RefreshWhileScanning active={meeting.minutes.some((m) => m.status === "scanning")} />
        {meeting.minutes.length === 0 ? (
          <p className="text-sm text-text-3">Chưa có biên bản đã ký. Chưa bắt buộc để chốt điểm.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm" data-testid="meeting-minutes">
            {meeting.minutes.map((m) => (
              <li key={m.number} className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">Đã ký · bản {m.number}</span>
                <b>{m.fileName}</b>
                <span className="text-text-2">
                  {m.uploadedBy.fullName}, {formatVnDateTime(m.uploadedAt)}
                </span>
                {m.status === "clean" ? (
                  <DownloadButton fileId={String(m.number)} download={downloadMinutesAction.bind(null, meeting.id)} label="Tải PDF" />
                ) : m.status === "blocked" ? (
                  <span className="text-danger">Tệp bị chặn vì không an toàn</span>
                ) : (
                  <span className="text-amber">Đang quét virus</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {can(actor, "scoring.meeting.minutes.upload") && <MinutesUploader meetingId={meeting.id} count={meeting.minutes.length} />}
      </section>
    </div>
  );
}
