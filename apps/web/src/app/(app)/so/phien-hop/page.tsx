import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { formatIsoDate } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * L16 HD-11 (#83, spec #79 stories 9 to 12): every Phiên họp of every Hội đồng, newest first, with its Quyết định công
 * nhận once the Cán bộ Sở has recorded it. A Phiên họp đã kết thúc without one is what waits for the Sở.
 */
export default async function ProvinceMeetingsPage() {
  const actor = await requireActor();
  const meetings = await app().core.results.meetingsForDecision(actor);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Phiên họp và Quyết định công nhận</h1>
        <p className="text-sm text-text-2">
          Ghi nhận Quyết định công nhận đã ký của Phiên họp đã kết thúc: hồ sơ 3 và 4 sao được công nhận, hồ sơ 5 sao vào danh sách đề xuất 5 sao, kết quả được
          công bố cho Chủ thể.
        </p>
      </div>
      {meetings.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Chưa có Phiên họp">
          Phiên họp do Hội đồng lập sẽ hiện ở đây.
        </EmptyState>
      ) : (
        <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-2">
              <tr>
                <th className="px-3 py-2">Phiên họp</th>
                <th className="px-3 py-2">Ngày họp</th>
                <th className="px-3 py-2">Hội đồng, đợt</th>
                <th className="px-3 py-2">Hồ sơ</th>
                <th className="px-3 py-2">Quyết định công nhận</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.id} className="border-b last:border-0" data-testid="province-meeting-row">
                  <td className="px-3 py-2">
                    <Link href={`/so/phien-hop/${m.id}`} className="text-brand">
                      {m.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatIsoDate(m.heldOn)}</td>
                  <td className="px-3 py-2">
                    {m.council.name}
                    <span className="block text-xs text-text-3">{m.round.name}</span>
                  </td>
                  <td className="px-3 py-2">{m.dossierCount}</td>
                  <td className="px-3 py-2">
                    {m.decision ? (
                      <span>
                        Số {m.decision.number}, ký ngày {formatIsoDate(m.decision.signedOn)}
                      </span>
                    ) : m.state === "open" ? (
                      <span className="text-text-3">Phiên họp đang mở</span>
                    ) : (
                      <span className="text-amber">Chờ ghi nhận</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
