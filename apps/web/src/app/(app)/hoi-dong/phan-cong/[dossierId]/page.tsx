import { can, GRADING_MODE_LABEL } from "@ocop/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DossierStateTag } from "@/components/dossiers/dossier-state-tag";
import { formatVnDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { AddForm, ReplaceForm, type CurrentPerson } from "./replace-forms";

export const dynamic = "force-dynamic";

const KIND_LABEL = { member: "Thành viên chấm", advisory: "Thành viên Tổ tư vấn" } as const;
const SHEET_LABEL = { draft: "Đang xem xét", confirmed: "Đã xác nhận", absent: "Vắng", superseded: "Bị thay thế" } as const;

/**
 * S41 Phân công of one hồ sơ after Giao chấm (L09 HD-03, #55; spec #49 stories 34 to 39): the Phân công in force
 * with each thành viên chấm's phiếu state (never points), the Thư ký's thay and bổ sung forms, each with a reason,
 * and the Phân công replaced so far, with who replaced them, when and why. The Chủ tịch reads the same page.
 */
export default async function DossierAssignmentPage({ params }: { params: Promise<{ dossierId: string }> }) {
  const actor = await requireActor();
  const { dossierId } = await params;
  const [dossier, assignments, history] = await Promise.all([
    app().core.dossiers.get(actor, { dossierId }).catch(orNotFound),
    app().core.councils.assignments(actor, { dossierId }).catch(orNotFound),
    app().core.councils.assignmentHistory(actor, { dossierId }).catch(orNotFound),
  ]);
  if (!dossier || !assignments || !history) notFound();
  const [candidates, progress, round] = await Promise.all([
    app().core.councils.assignmentCandidates(actor),
    app().core.scoring.gradingProgress(actor),
    dossier.roundId ? app().core.rounds.getRound(actor, { roundId: dossier.roundId }) : null,
  ]);
  const sheets = new Map((progress.find((p) => p.dossierId === dossierId)?.progress ?? []).map((p) => [p.userId, p.state]));
  const current: CurrentPerson[] = assignments
    .filter((a) => a.effectiveAt !== null)
    .map((a) => ({ userId: a.userId, fullName: a.fullName, kind: a.kind, confirmed: a.kind === "member" && sheets.get(a.userId) === "confirmed" }));
  const editable = can(actor, "dossier.assignment.replace", dossier);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/hoi-dong/phan-cong" className="text-sm text-text-2 hover:underline">
          ← Phân công hồ sơ
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold">
          <span className="font-mono">{dossier.code}</span> {dossier.productName || "(Chưa đặt tên sản phẩm)"} <DossierStateTag state={dossier.state} />
        </h1>
        <p className="text-sm text-text-2">
          {dossier.round?.name ?? "—"}
          {round && ` · ${GRADING_MODE_LABEL[round.gradingMode]} · cần ít nhất ${round.aggregation.minGraders} thành viên chấm`}
        </p>
      </div>

      <section className="overflow-x-auto rounded-lg border bg-surface shadow-card" aria-label="Phân công đang hiệu lực">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface-2">
            <tr>
              <th className="px-3 py-2">Người</th>
              <th className="px-3 py-2">Vai</th>
              <th className="px-3 py-2">Hiệu lực từ</th>
              <th className="px-3 py-2">Phiếu chấm</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.userId} className="border-b last:border-0" data-testid="assignment-row">
                <td className="px-3 py-2">{a.fullName}</td>
                <td className="px-3 py-2">{KIND_LABEL[a.kind]}</td>
                <td className="px-3 py-2 whitespace-nowrap">{a.effectiveAt ? formatVnDateTime(a.effectiveAt) : "Nháp"}</td>
                <td className="px-3 py-2">{a.kind === "member" ? SHEET_LABEL[sheets.get(a.userId) ?? "draft"] : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {editable && (
        <div className="grid gap-4 md:grid-cols-2">
          <ReplaceForm key={`r${dossier.version}`} dossierId={dossierId} version={dossier.version} current={current} candidates={candidates} />
          <AddForm
            key={`a${dossier.version}`}
            dossierId={dossierId}
            version={dossier.version}
            current={current}
            candidates={candidates}
            advisoryMode={round?.gradingMode === "advisory_based"}
          />
        </div>
      )}

      <section className="flex flex-col gap-2" aria-label="Lịch sử thay thành viên">
        <h2 className="font-medium">Lịch sử thay thành viên</h2>
        {history.length === 0 ? (
          <p className="text-sm text-text-3">Chưa thay ai.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((h) => (
              <li key={`${h.userId}${h.replacedAt.toISOString()}`} className="rounded-lg border bg-surface p-3 text-sm shadow-card" data-testid="replaced-row">
                <p>
                  <b>{h.fullName}</b> ({KIND_LABEL[h.kind]}) bị thay lúc {formatVnDateTime(h.replacedAt)} bởi {h.replacedBy.fullName}
                </p>
                <p className="text-text-2">Lý do: {h.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
