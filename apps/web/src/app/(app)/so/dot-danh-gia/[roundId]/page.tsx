import { can, DomainError, GRADING_MODE_LABEL, vnDateOf } from "@ocop/core";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RoundStatusTag } from "@/components/rounds/round-status-tag";
import { formatVnDate, formatVnDateTime } from "@/lib/format";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { deleteRoundAction, openRoundAction, updateRoundAction } from "../actions";
import { RoundActionButton } from "../round-buttons";
import { RoundForm } from "../round-form";

export const dynamic = "force-dynamic";

const orNotFound = (err: unknown) => (err instanceof DomainError && err.code === "not_found" ? null : Promise.reject(err));

/** S82: one Đợt đánh giá; while Nháp, Cán bộ Sở edits, opens or deletes it (L07 SO-01). */
export default async function RoundPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const actor = await requireActor();
  const round = await app().core.rounds.getRound(actor, { roundId }).catch(orNotFound);
  if (!round) notFound();
  const editable = round.status === "draft" && can(actor, "round.manage");
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
    </div>
  );
}
