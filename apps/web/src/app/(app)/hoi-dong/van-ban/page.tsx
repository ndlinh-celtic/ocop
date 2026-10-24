import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { formatIsoDate } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { CreateMeetingForm } from "./meeting-forms";

export const dynamic = "force-dynamic";

/**
 * S44 Phiên họp (L15 HD-09; stories 107 to 109): the Phiên họp of the Hội đồng, newest first, and the form to lập
 * one with hồ sơ Sẵn sàng chốt not yet in an open Phiên họp. Văn bản họp of a Phiên họp come with #62.
 */
export default async function MeetingsPage() {
  const actor = await requireActor();
  const councilId = actor.activeScope?.type === "council" ? actor.activeScope.id : null;
  const [meetings, rounds, progress] = await Promise.all([
    app().core.scoring.listMeetings(actor),
    app().core.rounds.listRounds(actor),
    app().core.scoring.gradingProgress(actor),
  ]);
  const councilRounds = rounds.filter((r) => councilId && r.council?.id === councilId && r.status !== "ended").map((r) => ({ id: r.id, name: r.name }));
  const candidates = [];
  for (const r of progress.filter((p) => p.state === "member_confirmed")) {
    if (await app().core.scoring.meetingOf(actor, { dossierId: r.dossierId })) continue;
    candidates.push({ dossierId: r.dossierId, code: r.code, productName: `${r.productName || "(Chưa đặt tên sản phẩm)"}${r.round ? ` · ${r.round.name}` : ""}`, roundId: r.round?.id ?? null });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Phiên họp</h1>
        <p className="text-sm text-text-2">Lập Phiên họp của Hội đồng với các hồ sơ Sẵn sàng chốt, rồi chốt điểm từng hồ sơ ở màn Tổng hợp điểm.</p>
      </div>
      <CreateMeetingForm rounds={councilRounds} candidates={candidates} />
      {meetings.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Chưa có Phiên họp">
          Phiên họp hiện ở đây sau khi được lập.
        </EmptyState>
      ) : (
        <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-3 py-2">Phiên họp</th>
                <th className="px-3 py-2">Ngày họp</th>
                <th className="px-3 py-2">Đợt</th>
                <th className="px-3 py-2">Hồ sơ đã chốt</th>
                <th className="px-3 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.id} className="border-b last:border-0" data-testid="meeting-row">
                  <td className="px-3 py-2">
                    <Link href={`/hoi-dong/van-ban/${m.id}`} className="text-brand">
                      {m.title}
                    </Link>
                    <span className="block text-xs text-text-3">{m.location}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatIsoDate(m.heldOn)}</td>
                  <td className="px-3 py-2">{m.round.name}</td>
                  <td className="px-3 py-2">
                    {m.finalizedCount} / {m.dossierCount}
                  </td>
                  <td className="px-3 py-2">{m.state === "open" ? "Đang mở" : "Đã kết thúc"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
