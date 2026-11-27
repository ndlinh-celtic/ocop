import { DECISION_SECTION_LABEL } from "@ocop/core";
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
import { downloadDecisionAction } from "./actions";
import { AmendDecisionForm } from "./amend-form";
import { DecisionForm } from "./decision-form";

export const dynamic = "force-dynamic";

/**
 * L16 HD-11 (#83, spec #79 stories 9 to 16): one Phiên họp as the Sở sees it, each hồ sơ with its kết quả chốt and the
 * mục of the quyết định it falls in; once the Phiên họp is closed and every hồ sơ chốt, the form to ghi nhận the signed
 * Quyết định công nhận, then the quyết định itself.
 */
export default async function ProvinceMeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const actor = await requireActor();
  const { meetingId } = await params;
  const view = await app().core.results.meetingDecision(actor, { meetingId }).catch(orNotFound);
  if (!view) notFound();
  const { meeting, decision, dossiers } = view;
  const pending = dossiers.filter((d) => d.result === null);
  const recognized = dossiers.filter((d) => d.section === "three_star" || d.section === "four_star").length;
  const proposed = dossiers.filter((d) => d.section === "five_star_proposal").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/so/phien-hop" className="text-sm text-brand">
          ← Phiên họp
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{meeting.title}</h1>
        <p className="text-sm text-text-2">
          {meeting.council.name} · {formatIsoDate(meeting.heldOn)} · {meeting.location} · {meeting.round.name} ·{" "}
          {meeting.state === "open" ? "Đang mở" : "Đã kết thúc"}
        </p>
      </div>

      <section className="overflow-x-auto rounded-lg border bg-surface shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface-2">
            <tr>
              <th className="px-3 py-2">Mã hồ sơ</th>
              <th className="px-3 py-2">Sản phẩm</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Kết quả chốt</th>
              <th className="px-3 py-2">Mục trong quyết định</th>
            </tr>
          </thead>
          <tbody>
            {dossiers.map((d) => (
              <tr key={d.dossierId} className="border-b last:border-0" data-testid="decision-dossier">
                <td className="px-3 py-2 font-mono whitespace-nowrap">
                  <Link href={`/so/ho-so/${d.dossierId}`} className="text-brand">
                    {d.code}
                  </Link>
                </td>
                <td className="px-3 py-2">{d.productName || "(Chưa đặt tên sản phẩm)"}</td>
                <td className="px-3 py-2">
                  <DossierStateTag state={d.state} />
                </td>
                <td className="px-3 py-2">
                  {d.result ? `${d.result.star} sao · ${formatPoints(d.result.total)} điểm` : <span className="text-amber">Chưa có kết quả chốt</span>}
                </td>
                <td className="px-3 py-2">
                  {d.section ? DECISION_SECTION_LABEL[d.section] : d.result ? <span className="text-text-3">Không đạt, không có trong quyết định</span> : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card" aria-labelledby="quyet-dinh">
        <h2 id="quyet-dinh" className="font-semibold">
          Quyết định công nhận
        </h2>
        {decision ? (
          <div className="flex flex-col gap-2 text-sm" data-testid="recorded-decision">
            <RefreshWhileScanning active={decision.file.status === "scanning"} />
            <p>
              Số <b>{decision.number}</b>, ký ngày {formatIsoDate(decision.signedOn)}. Ghi nhận bởi {decision.recordedBy.fullName} lúc{" "}
              {formatVnDateTime(decision.recordedAt)}.
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <b>{decision.file.fileName}</b>
              {decision.file.status === "clean" ? (
                <DownloadButton fileId={decision.id} download={downloadDecisionAction} label="Tải PDF" />
              ) : decision.file.status === "blocked" ? (
                <span className="text-danger">Tệp bị chặn vì không an toàn</span>
              ) : (
                <span className="text-amber">Đang quét virus</span>
              )}
            </p>
            <Link href={`/so/giay-chung-nhan?decisionId=${decision.id}`} className="w-fit text-brand">
              Giấy chứng nhận của quyết định →
            </Link>
            <AmendDecisionForm decisionId={decision.id} number={decision.number} signedOn={decision.signedOn} />
          </div>
        ) : meeting.state === "open" ? (
          <p className="text-sm text-text-3">Phiên họp chưa kết thúc. Hội đồng cần chốt điểm và kết thúc Phiên họp trước.</p>
        ) : pending.length > 0 ? (
          <p className="text-sm text-amber">
            Còn hồ sơ chưa có kết quả chốt hiện hành: {pending.map((d) => d.code).join(", ")}. Hội đồng cần chốt lại các hồ sơ này trước khi ghi nhận.
          </p>
        ) : recognized + proposed === 0 ? (
          <p className="text-sm text-text-3">Phiên họp không có hồ sơ nào từ 3 sao nên không có quyết định công nhận.</p>
        ) : (
          <DecisionForm meetingId={meeting.id} recognized={recognized} proposed={proposed} />
        )}
      </section>
    </div>
  );
}
