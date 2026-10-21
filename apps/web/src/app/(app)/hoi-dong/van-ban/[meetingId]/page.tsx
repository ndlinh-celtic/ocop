import { Flag, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { formatPoints } from "@/components/scoring/aggregate-table";
import { formatIsoDate, formatVnDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { AddDossiersForm, CloseMeetingButton, RemoveDossierButton } from "../meeting-forms";

export const dynamic = "force-dynamic";

/**
 * S44 one Phiên họp (L15 HD-09; stories 107 to 109): its hồ sơ, chốt or still waiting, each opening S43 to chốt;
 * while open, the hồ sơ Sẵn sàng chốt of the đợt that may join it, gỡ for a hồ sơ not yet chốt, and Kết thúc once
 * none waits.
 */
export default async function MeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const actor = await requireActor();
  const { meetingId } = await params;
  const meeting = await app().core.scoring.getMeeting(actor, { meetingId }).catch(orNotFound);
  if (!meeting) notFound();
  const open = meeting.state === "open";
  const waiting = meeting.dossiers.filter((d) => d.result === null).length;

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
                  ) : (
                    <span className="text-text-3">Chưa chốt</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{open && !d.result && <RemoveDossierButton meetingId={meeting.id} dossierId={d.dossierId} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {open && <AddDossiersForm meetingId={meeting.id} candidates={meeting.candidates} />}
    </div>
  );
}
