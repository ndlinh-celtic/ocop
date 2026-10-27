import { EVIDENCE_ASSESSMENT_LABEL, type AdvisoryCriterionView } from "@ocop/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { AdvisoryReportVersion } from "@/components/scoring/advisory-report-version";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { AdvisoryEditor } from "../advisory-editor";
import { IssueButton } from "./issue-button";

export const dynamic = "force-dynamic";

const REISSUE_STATES = ["advisory_report_issued", "member_review", "member_confirmed"];

/**
 * S52 Soạn và phát hành báo cáo Tổ tư vấn (L11 TM-06, TM-07, TM-12; #56 stories 56 to 61): the nháp as it would be
 * issued, the check before phát hành, and for the Tổ trưởng only the phát hành of phiên bản 1 or, once issued,
 * phiên bản N+1 from the content of N with a reason; the history of phiên bản. No control here chốt điểm or
 * decides công nhận (TM-12).
 */
export default async function AdvisoryReportPage({ params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  const [dossier, ws, versions] = await Promise.all([
    app().core.dossiers.get(actor, { dossierId }).catch(orNotFound),
    app().core.scoring.advisoryReport(actor, { dossierId }).catch(orNotFound),
    app().core.scoring.advisoryReportVersions(actor, { dossierId }).catch(orNotFound),
  ]);
  if (!dossier || !ws || !versions) notFound();
  const latest = versions.at(-1);
  const nextNumber = (latest?.number ?? 0) + 1;
  const mayIssue = ws.isLeader && ws.state === "advisory_review";
  const mayReissue = ws.isLeader && latest !== undefined && REISSUE_STATES.includes(ws.state);
  // Phiên bản N+1 starts from the content of phiên bản N (story 60).
  const fromLatest: AdvisoryCriterionView[] = latest
    ? ws.criteria.map((c) => {
        const l = latest.report.lines.find((x) => x.criterionId === c.criterionId);
        return l
          ? {
              ...c,
              line: {
                criterionId: c.criterionId,
                levelId: l.levelId,
                points: l.points,
                basis: l.basis,
                evidenceFileIds: l.evidence.map((e) => e.fileId),
                evidenceAssessment: l.evidenceAssessment,
              },
            }
          : c;
      })
    : ws.criteria;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/to-tu-van/ho-so/${dossierId}`} className="text-sm text-brand">
          ← Thẩm định hồ sơ
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-xl font-semibold">
          Báo cáo Tổ tư vấn · {dossier.productName || "Hồ sơ chưa đặt tên sản phẩm"} <DossierStateTag state={dossier.state} />
        </h1>
        <p className="text-sm text-text-2">
          Mã hồ sơ <b className="font-mono">{dossier.code}</b> · {latest ? `Phiên bản ${latest.number} đã phát hành` : "Nháp"}
        </p>
      </div>

      {ws.state === "advisory_review" && (
        <section className="flex flex-col gap-3 rounded-lg border bg-surface p-4 text-sm shadow-card">
          <h2 className="font-semibold">Kiểm tra trước phát hành</h2>
          {ws.missing.length === 0 ? (
            <p className="text-brand">Mọi tiêu chí đã có Điểm đề xuất và căn cứ.</p>
          ) : (
            <p className="text-amber">
              Còn {ws.missing.length} tiêu chí chưa có Điểm đề xuất hoặc căn cứ: {ws.missing.join(", ")}.
            </p>
          )}
          <p>
            Ước lượng: {ws.estimate.parts.map((p) => `Phần ${p.code}: ${p.total}`).join(" · ")} · Tổng {ws.estimate.total} · {ws.estimate.star} sao
          </p>
          {mayIssue ? (
            <IssueButton dossierId={dossierId} dossierVersion={ws.dossierVersion} reportNumber={nextNumber} blocked={ws.missing.length > 0} />
          ) : (
            <p className="text-text-3">Chỉ Tổ trưởng Tổ tư vấn phát hành được báo cáo.</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b bg-surface-2">
                <tr>
                  <th className="px-3 py-2">Tiêu chí</th>
                  <th className="px-3 py-2">Điểm đề xuất</th>
                  <th className="px-3 py-2">Căn cứ</th>
                  <th className="px-3 py-2">Minh chứng</th>
                </tr>
              </thead>
              <tbody>
                {ws.criteria.map((c) => (
                  <tr key={c.criterionId} className="border-b align-top last:border-0">
                    <td className="px-3 py-2">
                      <b>{c.code}</b> {c.name}
                    </td>
                    <td className="px-3 py-2">{c.line.points ?? <span className="text-amber">Chưa chọn</span>}</td>
                    <td className="px-3 py-2 whitespace-pre-line">{c.line.basis || <span className="text-amber">Chưa có</span>}</td>
                    <td className="px-3 py-2">{c.line.evidenceAssessment ? EVIDENCE_ASSESSMENT_LABEL[c.line.evidenceAssessment] : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="font-semibold">Nhận xét tổng hợp</h3>
            <p className="whitespace-pre-line">{ws.summary || "—"}</p>
            <h3 className="mt-2 font-semibold">Điểm cần hội đồng lưu ý</h3>
            <p className="whitespace-pre-line">{ws.notes || "—"}</p>
          </div>
          <Link href={`/to-tu-van/ho-so/${dossierId}`} className="font-semibold text-brand">
            Sửa bản nháp →
          </Link>
        </section>
      )}

      {mayReissue && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Phát hành phiên bản {nextNumber}</h2>
          <p className="text-sm text-text-2">Nội dung bắt đầu từ phiên bản {latest.number}. Thành viên được phân công sẽ nhận thông báo.</p>
          <AdvisoryEditor
            dossierId={dossierId}
            criteria={fromLatest}
            summary={latest.report.summary}
            notes={latest.report.notes}
            attachments={latest.report.attachments.map((a) => ({ ...a, status: "clean" }))}
            mode={{ kind: "reissue", dossierVersion: ws.dossierVersion, nextNumber }}
          />
        </section>
      )}
      {ws.state === "score_finalized" && <p className="text-sm text-text-2">Hồ sơ đã chốt điểm nên không phát hành phiên bản mới được.</p>}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Lịch sử phiên bản</h2>
        {versions.length === 0 ? (
          <p className="text-sm text-text-3">Chưa phát hành phiên bản nào.</p>
        ) : (
          [...versions].reverse().map((v, i) => <AdvisoryReportVersion key={v.id} dossierId={dossierId} version={v} open={i === 0} />)
        )}
      </section>
    </div>
  );
}
