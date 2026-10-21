import { lockDossier } from "../dossiers/edit";
import { dossierNotFound, type Dossier } from "../dossiers/model";
import { transition } from "../dossiers/transition";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { emit } from "../platform/emit";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { ASSIGNMENT_KINDS, type Assignment, type AssignmentKind } from "./assignment-model";
import { checkEligible, conflictOfRoles, eligibleOf } from "./assignments";
import { openScoreSheets } from "./grading";

/*
 * L09 HD-03 (spec #49 stories 34 to 39): after Giao chấm and until chốt điểm, the Thư ký hội đồng thay a thành
 * viên chấm whose Phiếu chấm is not yet xác nhận, or a Thành viên Tổ tư vấn, and bổ sung either, always with a
 * reason (xung đột lợi ích is declared on paper, outside the system). The old Phân công is kept and marked
 * replaced, which ends the person's DataScope `assigned` on the hồ sơ; their nháp is superseded, never deleted
 * (ADR 0008). The new Phân công is in force at once, with a Phiếu chấm trống for a thành viên chấm, which in
 * dựa trên Tổ tư vấn waits for the next sao chép. Off the Chủ thể's timeline; audited and notified.
 */

const MAX_REASON = 2_000;

export interface ReplaceAssignmentInput {
  dossierId: string;
  /** The version of the hồ sơ the Thư ký last saw. */
  expectedVersion: number;
  /** Who is replaced: a Người dùng with a Phân công in force on the hồ sơ. */
  userId: string;
  /** Who takes over, with the same kind of Phân công. */
  newUserId: string;
  reason: string;
}

export interface AddAssignmentInput {
  dossierId: string;
  expectedVersion: number;
  userId: string;
  kind: AssignmentKind;
  reason: string;
}

export interface ReplacedAssignmentView {
  userId: string;
  fullName: string;
  kind: AssignmentKind;
  effectiveAt: Date;
  replacedAt: Date;
  replacedBy: { userId: string; fullName: string };
  reason: string;
}

function reasonOf(input: { reason?: unknown }): string {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason === "") throw new DomainError("reason_required", "Nhập lý do thay hoặc bổ sung thành viên");
  if (reason.length > MAX_REASON) throw new DomainError("field_too_long", "Lý do quá dài");
  return reason;
}

/** Stories 34 to 36, 38, 39: thay one Phân công in force by another of the same kind. */
export function replaceAssignment(deps: CoreDeps) {
  return async (actor: Actor, input: ReplaceAssignmentInput): Promise<{ version: number }> => {
    authorize(actor, "dossier.write");
    const reason = reasonOf(input);
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const { before, current } = await begin(tx, actor, input.dossierId);
      const old = current.find((a) => a.userId === input.userId && a.effectiveAt !== null);
      // transition() first, so a wrong state, Vai trò or version is reported as such.
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.assignment.replace",
        expectedVersion: input.expectedVersion,
        reason,
        metadata: { kind: old?.kind ?? null, replacedUserId: input.userId, newUserId: input.newUserId },
      });
      if (!old) throw new DomainError("assignment_not_found", "Người này không có Phân công đang hiệu lực trên hồ sơ");
      await checkNewcomer(deps, tx, before, current, input.newUserId, old.kind, now);

      // Story 35: a phiếu đã xác nhận is never dropped quietly.
      const sheet = old.kind === "member" ? (await tx.scoreSheets.current(before.id)).find((s) => s.assignmentId === old.id) : undefined;
      if (sheet && sheet.state !== "draft") {
        throw new DomainError("assignment_sheet_confirmed", "Thành viên đã xác nhận Phiếu chấm nên không thay được");
      }
      if (!(await tx.assignments.markReplaced(old.id, now, actor.userId, reason))) throw new Error(`assignment ${old.id} changed under a lock`);
      const created = await insertInForce(deps, tx, actor, before.id, input.newUserId, old.kind, now);
      if (sheet) {
        const newSheet = created.scoreSheetIds[0] ?? null;
        const superseded = { ...sheet, state: "superseded" as const, supersededBy: newSheet, supersededReason: reason, version: sheet.version + 1, updatedAt: now };
        if (!(await tx.scoreSheets.update(superseded, sheet.version))) throw new Error(`score sheet ${sheet.id} changed under a lock`);
      }
      await emit(deps, tx, {
        type: "council.assignment.replaced",
        payload: { dossierId: before.id, entityId: before.entityId, kind: old.kind, replacedUserId: old.userId, newUserId: input.newUserId },
      });
      return { version: after.version };
    });
  };
}

/** Stories 36, 37, 39: bổ sung a thành viên chấm or Thành viên Tổ tư vấn, in force at once. */
export function addAssignment(deps: CoreDeps) {
  return async (actor: Actor, input: AddAssignmentInput): Promise<{ version: number }> => {
    authorize(actor, "dossier.write");
    const reason = reasonOf(input);
    if (!(ASSIGNMENT_KINDS as readonly string[]).includes(input.kind)) throw new DomainError("invalid_kind", "Chọn thành viên chấm hoặc Thành viên Tổ tư vấn");
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const { before, current } = await begin(tx, actor, input.dossierId);
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.assignment.replace",
        expectedVersion: input.expectedVersion,
        reason,
        metadata: { kind: input.kind, replacedUserId: null, newUserId: input.userId },
      });
      await checkNewcomer(deps, tx, before, current, input.userId, input.kind, now);
      await insertInForce(deps, tx, actor, before.id, input.userId, input.kind, now);
      await emit(deps, tx, {
        type: "council.assignment.added",
        payload: { dossierId: before.id, entityId: before.entityId, kind: input.kind, replacedUserId: null, newUserId: input.userId },
      });
      return { version: after.version };
    });
  };
}

/** HD-03: the Phân công replaced on a hồ sơ of the Hội đồng, with who replaced them and why, for its Chủ tịch and Thư ký. */
export function assignmentHistory(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<ReplacedAssignmentView[]> => {
    authorize(actor, "dossier.assignment.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      if (!(await tx.dossiers.findById(scope, input.dossierId))) throw dossierNotFound();
      const names = new Map<string, string>();
      const nameOf = async (id: string) => {
        if (!names.has(id)) names.set(id, (await tx.users.findById(id))?.fullName ?? "");
        return names.get(id)!;
      };
      const views: ReplacedAssignmentView[] = [];
      for (const a of await tx.assignments.replaced(input.dossierId)) {
        views.push({
          userId: a.userId,
          fullName: await nameOf(a.userId),
          kind: a.kind,
          effectiveAt: a.effectiveAt!,
          replacedAt: a.replacedAt!,
          replacedBy: { userId: a.replacedBy!, fullName: await nameOf(a.replacedBy!) },
          reason: a.replaceReason ?? "",
        });
      }
      return views;
    });
  };
}

async function begin(tx: Tx, actor: UserActor, dossierId: string) {
  const before = await lockDossier(tx, actor, dossierId);
  return { before, current: await tx.assignments.current(before.id) };
}

/**
 * The newcomer: never Phân công on the hồ sơ in the other role, even if replaced since (story 28), not on it now,
 * holding the Phân vai, and no Tổ tư vấn in chấm trực tiếp.
 */
async function checkNewcomer(deps: CoreDeps, tx: Tx, dossier: Dossier, current: Assignment[], userId: string, kind: AssignmentKind, now: Date) {
  const everOnIt = [...current, ...(await tx.assignments.replaced(dossier.id))].filter((a) => a.userId === userId);
  if (everOnIt.some((a) => a.kind !== kind)) throw conflictOfRoles();
  if (current.some((a) => a.userId === userId)) throw new DomainError("already_assigned", "Người này đã được Phân công trên hồ sơ");
  if (kind === "advisory") {
    const round = (await tx.rounds.findById(dossier.roundId!))!;
    if (round.gradingMode !== "advisory_based") {
      throw new DomainError("advisory_assignment_in_direct_mode", "Đợt chấm trực tiếp nên hồ sơ không có Tổ tư vấn");
    }
  }
  checkEligible(await eligibleOf(tx, dossier.councilId!, now), kind === "member" ? [userId] : [], kind === "advisory" ? [userId] : []);
}

async function insertInForce(deps: CoreDeps, tx: Tx, actor: UserActor, dossierId: string, userId: string, kind: AssignmentKind, now: Date) {
  const a: Assignment = {
    id: deps.ids.next(),
    dossierId,
    userId,
    kind,
    createdBy: actor.userId,
    createdAt: now,
    effectiveAt: now,
    replacedAt: null,
    replacedBy: null,
    replaceReason: null,
  };
  await tx.assignments.insert(a);
  const scoreSheetIds = kind === "member" ? await openScoreSheets(deps, tx, dossierId, [a.id], now) : [];
  return { assignmentId: a.id, scoreSheetIds };
}
