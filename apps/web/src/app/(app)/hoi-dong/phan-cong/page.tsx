import { GRADING_MODE_LABEL } from "@ocop/core";
import { GitFork } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { app } from "@/server/app";
import { requireActor } from "@/server/session";
import { AssignmentBoard, type BoardRow } from "./assignment-board";
import { GradingModeForm, type RoundModeRow } from "./grading-mode-form";

export const dynamic = "force-dynamic";

/**
 * S41 Phân công, the part the Thư ký composes (L09 HD-02, HD-03, #52; spec #49 stories 24 to 29): the hồ sơ
 * Đã chuyển tỉnh of the đợt gán to the Hội đồng, each with its Phân công nháp or in force, and one form
 * that writes the same thành viên chấm and Thành viên Tổ tư vấn on every checked hồ sơ. Above it, the Chế độ
 * chấm of each đợt of the Hội đồng, and beside it Giao chấm of the checked hồ sơ (#53, HD-06).
 */
export default async function AssignmentPage({ searchParams }: { searchParams: Promise<{ dot?: string }> }) {
  const actor = await requireActor();
  const q = await searchParams;
  const [dossiers, candidates, rounds] = await Promise.all([
    app().core.dossiers.list(actor, { state: "forwarded_to_province", ...(q.dot ? { roundId: q.dot } : {}) }),
    app().core.councils.assignmentCandidates(actor),
    app().core.rounds.listRounds(actor),
  ]);
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const rows: BoardRow[] = [];
  for (const d of dossiers) {
    const round = d.roundId ? roundById.get(d.roundId) : undefined;
    rows.push({
      dossierId: d.id,
      version: d.version,
      code: d.code,
      productName: d.productName,
      entityName: d.entity.name,
      productGroup: d.productGroup?.name ?? null,
      roundName: d.round?.name ?? null,
      gradingMode: round ? GRADING_MODE_LABEL[round.gradingMode] : null,
      minGraders: round?.aggregation.minGraders ?? null,
      received: d.provinceReceivedAt !== null,
      assignments: (await app().core.councils.assignments(actor, { dossierId: d.id })).map((a) => ({
        userId: a.userId,
        fullName: a.fullName,
        kind: a.kind,
        inForce: a.effectiveAt !== null,
      })),
    });
  }
  const councilRounds = [...new Map(dossiers.flatMap((d) => (d.round ? [[d.round.id, d.round.name] as const] : []))).entries()];
  // Chế độ chấm (stories 20, 21): the đợt gán to the Hội đồng of the Vai trò đang dùng that still take hồ sơ.
  const councilId = actor.activeScope?.type === "council" ? actor.activeScope.id : null;
  const modeRows: RoundModeRow[] = [];
  for (const r of rounds) {
    if (!councilId || r.council?.id !== councilId || (r.status !== "open_for_submission" && r.status !== "submission_closed")) continue;
    const detail = await app().core.rounds.getRound(actor, { roundId: r.id });
    modeRows.push({ roundId: r.id, name: r.name, gradingMode: r.gradingMode, minGraders: r.aggregation.minGraders, locked: detail.gradingConfigLocked });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Phân công hồ sơ</h1>
        <p className="text-sm text-text-2">
          Chọn hồ sơ, rồi chọn thành viên chấm và Thành viên Tổ tư vấn. Phân công là bản nháp, chưa ai thấy hồ sơ cho đến khi Giao chấm.
        </p>
      </div>
      {modeRows.length > 0 && (
        <section className="grid gap-3 md:grid-cols-2" aria-label="Chế độ chấm của đợt">
          {modeRows.map((r) => (
            <GradingModeForm key={r.roundId} round={r} />
          ))}
        </section>
      )}
      {councilRounds.length > 1 && (
        <form method="get" className="flex items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            Đợt
            <select name="dot" defaultValue={q.dot ?? ""} className="rounded-lg border border-line-strong bg-surface px-2 py-1">
              <option value="">Mọi đợt</option>
              {councilRounds.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-lg border border-line-strong px-3 py-1">
            Lọc
          </button>
        </form>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={GitFork} title="Chưa có hồ sơ cần phân công">
          Hồ sơ của các đợt gán cho Hội đồng sẽ hiện ở đây sau khi Sở tiếp nhận tại tỉnh.
        </EmptyState>
      ) : (
        <AssignmentBoard rows={rows} candidates={candidates} />
      )}
    </div>
  );
}
