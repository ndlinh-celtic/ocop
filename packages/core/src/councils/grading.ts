import { auditEntry } from "../audit/audit";
import { lockDossier } from "../dossiers/edit";
import type { DossierState } from "../dossiers/model";
import { transition } from "../dossiers/transition";
import { authorize } from "../identity/policy";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import type { Tx } from "../shared/uow";
import type { ScoreSheet } from "../scoring/score-sheet-model";
import { checkEligible, eligibleOf } from "./assignments";

export interface StartGradingInput {
  /** One or more hồ sơ, each with the version the Thư ký last saw (story 30). */
  dossiers: { dossierId: string; expectedVersion: number }[];
}

/**
 * L09 HD-06 (stories 30 to 33, 40, 82): the Thư ký hội đồng Giao chấm one or more hồ sơ Tiếp nhận tại tỉnh.
 * By the Chế độ chấm of each hồ sơ's đợt at this moment, it goes to Tổ tư vấn thẩm định (dựa trên Tổ tư vấn)
 * or Thành viên xem xét (chấm trực tiếp). Its Phân công nháp takes effect, so the people it names see the
 * hồ sơ and hear of it, and every thành viên chấm without one gets a Phiếu chấm trống. Refused with too few
 * thành viên chấm for the Quy tắc tổng hợp, without a Thành viên Tổ tư vấn in dựa trên Tổ tư vấn, and with a
 * Phân công Tổ tư vấn nháp in chấm trực tiếp (the Thư ký removes it first). All hồ sơ, or none.
 */
export function startGrading(deps: CoreDeps) {
  return async (actor: Actor, input: StartGradingInput): Promise<{ dossiers: { dossierId: string; version: number; state: DossierState }[] }> => {
    authorize(actor, "dossier.write");
    const dossiers = [...new Map(input.dossiers.map((d) => [d.dossierId, d])).values()];
    if (dossiers.length === 0) throw new DomainError("dossiers_required", "Chọn ít nhất một hồ sơ để Giao chấm");

    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const out: { dossierId: string; version: number; state: DossierState }[] = [];
      // Locked in id order, so two Thư ký on overlapping sets queue rather than deadlock.
      for (const d of [...dossiers].sort((a, b) => a.dossierId.localeCompare(b.dossierId))) {
        const before = await lockDossier(tx, actor, d.dossierId);
        // A hồ sơ in the Hội đồng's scope always has a đợt with that Hội đồng.
        const round = (await tx.rounds.findById(before.roundId!))!;
        const advisory = round.gradingMode === "advisory_based";
        // transition() first, so a wrong state, Vai trò, version or a hồ sơ not Tiếp nhận is reported as such.
        const after = await transition(deps, tx, actor, before, {
          action: advisory ? "dossier.grading.start_advisory" : "dossier.grading.start_direct",
          expectedVersion: d.expectedVersion,
          patch: { gradingStartedAt: now },
          // The Chủ thể reads this row (story 137): the Chế độ chấm, never who is Phân công.
          metadata: { gradingMode: round.gradingMode },
        });

        const current = await tx.assignments.current(before.id);
        const members = current.filter((a) => a.kind === "member");
        const advisors = current.filter((a) => a.kind === "advisory");
        if (members.length < round.aggregation.minGraders) {
          throw new DomainError(
            "not_enough_graders",
            `Hồ sơ ${before.code} mới có ${members.length} thành viên chấm, Quy tắc tổng hợp của đợt cần ít nhất ${round.aggregation.minGraders}`,
          );
        }
        if (advisory && advisors.length === 0) {
          throw new DomainError("advisory_member_required", `Hồ sơ ${before.code} chưa có Thành viên Tổ tư vấn; đợt chấm dựa trên Tổ tư vấn`);
        }
        if (!advisory && advisors.some((a) => a.effectiveAt === null)) {
          throw new DomainError(
            "advisory_assignment_in_direct_mode",
            `Đợt chấm trực tiếp nên hồ sơ ${before.code} không có Tổ tư vấn; hãy bỏ Thành viên Tổ tư vấn khỏi Phân công trước khi Giao chấm`,
          );
        }
        // Who was chosen still holds the Phân vai for it (stories 25, 26).
        checkEligible(
          await eligibleOf(tx, before.councilId!, now),
          members.map((a) => a.userId),
          advisors.map((a) => a.userId),
        );

        const tookEffect = await tx.assignments.takeEffect(before.id, now);
        const scoreSheetIds = await openScoreSheets(deps, tx, before.id, members.map((a) => a.id), now);
        await tx.audit.append(
          auditEntry(actor, deps.ids.next(), now, {
            action: "council.assignments.took_effect",
            targetType: "dossier",
            targetId: before.id,
            metadata: {
              gradingMode: round.gradingMode,
              members: members.map((a) => a.userId),
              advisors: advisors.map((a) => a.userId),
              tookEffect,
              scoreSheetIds,
            },
          }),
        );
        out.push({ dossierId: before.id, version: after.version, state: after.state });
      }
      // In the order asked for.
      return { dossiers: dossiers.map((d) => out.find((o) => o.dossierId === d.dossierId)!) };
    });
  };
}

/** A Phiếu chấm trống for each Phân công thành viên chấm that has no current one yet (a Giao chấm again keeps them). */
export async function openScoreSheets(deps: CoreDeps, tx: Tx, dossierId: string, assignmentIds: string[], now: Date): Promise<string[]> {
  const have = new Set((await tx.scoreSheets.current(dossierId)).map((s) => s.assignmentId));
  const opened: string[] = [];
  for (const assignmentId of assignmentIds) {
    if (have.has(assignmentId)) continue;
    const sheet: ScoreSheet = {
      id: deps.ids.next(),
      dossierId,
      assignmentId,
      attempt: 1,
      state: "draft",
      confirmedAt: null,
      reauthMethod: null,
      supersededBy: null,
      supersededReason: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await tx.scoreSheets.insert(sheet);
    opened.push(sheet.id);
  }
  return opened;
}
