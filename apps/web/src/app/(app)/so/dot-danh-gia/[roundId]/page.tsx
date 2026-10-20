import { can, GRADING_MODE_LABEL, isPastSubmissionDeadline, vnDateOf } from "@ocop/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RoundStatusTag } from "@/components/rounds/round-status-tag";
import { formatVnDate, formatVnDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { changeAggregationRuleAction, changeGradingModeAction, deleteRoundAction, endRoundAction, openRoundAction, updateRoundAction } from "../actions";
import { RoundActionButton } from "../round-buttons";
import { RoundConfigForms } from "../round-config-form";
import { RoundForm } from "../round-form";
import { ExtendDeadlineForm } from "./extend-deadline-form";
import { extendDeadlineAction } from "./extension-actions";
import { ExtensionHistory } from "./extension-history";

export const dynamic = "force-dynamic";

/**
 * S82: one Đợt đánh giá. While Nháp, Cán bộ Sở edits, opens or deletes it (L07 SO-01); once opened, changes
 * Chế độ chấm and Quy tắc tổng hợp (HD-06), ends it from Đã đóng nộp, and extends
 * Hạn nộp xã, Hạn gửi tỉnh or Hạn đánh giá tỉnh (Gia hạn đợt).
 */
export default async function RoundPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const actor = await requireActor();
  const round = await app().core.rounds.getRound(actor, { roundId }).catch(orNotFound);
  if (!round) notFound();
  const manager = can(actor, "round.manage");
  const editable = round.status === "draft" && manager;
  // L07 HD-06: after opening, only Chế độ chấm and Quy tắc tổng hợp change (until the first phiếu chấm).
  const configurable = manager && (round.status === "open_for_submission" || round.status === "submission_closed");
  const endable = manager && round.status === "submission_closed";
  // L07 Gia hạn đợt: an opened round that has not ended.
  const extendable = manager && (round.status === "open_for_submission" || round.status === "submission_closed");
  const extensions = round.status === "draft" ? [] : await app().core.rounds.listDeadlineExtensions(actor, { roundId });
  const versions = editable ? (await app().core.criteria.listVersions(actor)).filter((v) => v.status === "published") : [];
  const facts: [string, string][] = [
    ["Năm", String(round.year)],
    ["Hạn nộp xã", formatVnDate(round.submissionDeadline)],
    ["Hạn gửi tỉnh", formatVnDate(round.forwardingDeadline)],
    ["Hạn đánh giá tỉnh", formatVnDate(round.evaluationDeadline)],
    ["Phiên bản tiêu chí", round.criteriaVersion.legalBasis],
    ["Chế độ chấm", GRADING_MODE_LABEL[round.gradingMode]],
    [
      "Quy tắc tổng hợp",
      `Trung bình cộng, tối thiểu ${round.aggregation.minGraders} người chấm, cờ chênh lệch từ ${round.aggregation.deviationFlagPoints} điểm`,
    ],
    ["Mở lúc", round.openedAt ? formatVnDateTime(round.openedAt) : "Chưa mở"],
    ...(round.endedAt ? ([["Kết thúc lúc", formatVnDateTime(round.endedAt)]] as [string, string][]) : []),
  ];
  return (
    <div className="flex flex-col gap-6">
      <nav className="text-sm text-text-3">
        <Link href="/so/dot-danh-gia">Đợt đánh giá</Link> / {round.name}
      </nav>
      <div className="flex flex-wrap items-start gap-3">
        <h1 className="text-xl font-semibold">{round.name}</h1>
        <RoundStatusTag status={round.status} />
        {editable && (
          <div className="ml-auto flex flex-wrap gap-3">
            <RoundActionButton
              action={openRoundAction.bind(null, round.id)}
              label="Mở đợt"
              confirm="Mở đợt để chủ thể bắt đầu nộp hồ sơ? Sau khi mở, không đổi được Phiên bản tiêu chí."
            />
            <RoundActionButton action={deleteRoundAction.bind(null, round.id)} label="Xóa đợt" confirm="Xóa đợt Nháp này?" danger />
          </div>
        )}
        {endable && (
          <div className="ml-auto">
            <RoundActionButton
              action={endRoundAction.bind(null, round.id)}
              label="Kết thúc đợt"
              confirm="Kết thúc đợt? Chỉ kết thúc được khi mọi hồ sơ đã có kết quả; đợt Đã kết thúc không mở lại được."
            />
          </div>
        )}
      </div>
      <section className="rounded-lg border bg-surface p-4">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-text-3">{k}</dt>
              <dd className="text-sm font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      {configurable && (
        <section className="rounded-lg border bg-surface p-4">
          <h2 className="font-medium">Đổi cấu hình chấm</h2>
          {round.gradingConfigLocked ? (
            <p className="mt-1 text-sm text-text-2">
              Đợt đã có phiếu chấm, nên Chế độ chấm và Quy tắc tổng hợp đã khóa: mọi phiếu của đợt chấm theo cùng một cấu hình.
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-text-2">Đổi được cho đến khi đợt có phiếu chấm đầu tiên.</p>
              <RoundConfigForms
                gradingMode={round.gradingMode}
                aggregation={round.aggregation}
                changeGradingMode={changeGradingModeAction.bind(null, round.id)}
                changeAggregationRule={changeAggregationRuleAction.bind(null, round.id)}
              />
            </>
          )}
        </section>
      )}
      {editable && (
        <section className="rounded-lg border bg-surface p-4">
          <h2 className="mb-3 font-medium">Sửa đợt</h2>
          <RoundForm
            action={updateRoundAction.bind(null, round.id)}
            submitLabel="Lưu thay đổi"
            versions={versions.map((v) => ({ id: v.id, legalBasis: v.legalBasis, issuedOn: v.issuedOn }))}
            values={{
              name: round.name,
              year: round.year,
              submissionDeadline: vnDateOf(round.submissionDeadline),
              forwardingDeadline: vnDateOf(round.forwardingDeadline),
              evaluationDeadline: vnDateOf(round.evaluationDeadline),
              criteriaVersionId: round.criteriaVersionId,
              gradingMode: round.gradingMode,
              minGraders: round.aggregation.minGraders,
              deviationFlagPoints: round.aggregation.deviationFlagPoints,
            }}
          />
        </section>
      )}
      {extendable && (
        <section className="rounded-lg border bg-surface p-4">
          <h2 className="mb-3 font-medium">Gia hạn đợt</h2>
          <ExtendDeadlineForm
            action={extendDeadlineAction.bind(null, round.id)}
            current={{
              submission: vnDateOf(round.submissionDeadline),
              forwarding: vnDateOf(round.forwardingDeadline),
              evaluation: vnDateOf(round.evaluationDeadline),
            }}
            // Hạn nộp xã is not extendable once submission has closed, even before the job has marked it so.
            submissionClosed={round.status === "submission_closed" || isPastSubmissionDeadline(round, new Date())}
          />
        </section>
      )}
      {round.status !== "draft" && <ExtensionHistory extensions={extensions} />}
    </div>
  );
}
