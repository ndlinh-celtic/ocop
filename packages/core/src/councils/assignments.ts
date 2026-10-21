import { lockDossier } from "../dossiers/edit";
import { dossierNotFound } from "../dossiers/model";
import { transition } from "../dossiers/transition";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape, isUuid } from "../shared/ids";
import type { Tx } from "../shared/uow";
import type { Assignment, AssignmentKind } from "./assignment-model";
import { councilMembers } from "./read";

export interface EditAssignmentsInput {
  /** One or more hồ sơ, each with the version the Thư ký last saw (story 27). */
  dossiers: { dossierId: string; expectedVersion: number }[];
  /** Thành viên chấm: Người dùng with a Phân vai Thành viên hội đồng in force on the Hội đồng (story 25). */
  members: string[];
  /** Thành viên Tổ tư vấn: Người dùng with a Phân vai Thành viên Tổ tư vấn in force on the Hội đồng (story 26). */
  advisors: string[];
}

export interface AssignmentView {
  userId: string;
  fullName: string;
  kind: AssignmentKind;
  /** Null while it is a nháp (before Giao chấm). */
  effectiveAt: Date | null;
  createdAt: Date;
}

export interface AssignmentCandidate {
  userId: string;
  fullName: string;
}

const unique = (ids: readonly string[]) => [...new Set(ids)];

/**
 * L09 HD-02 (stories 25 to 29): the Thư ký hội đồng sets the Phân công of one or more hồ sơ Tiếp nhận tại
 * tỉnh to the same thành viên chấm and Thành viên Tổ tư vấn. A Phân công nháp is replaced freely; one in
 * force (after Giao chấm) is kept and may not be dropped or changed here (thay thế is its own step). One
 * person in both lists is refused (`conflict_of_roles`, story 28). All hồ sơ change in one transaction, or
 * none does.
 */
export function editAssignments(deps: CoreDeps) {
  return async (actor: Actor, input: EditAssignmentsInput): Promise<{ dossiers: { dossierId: string; version: number }[] }> => {
    authorize(actor, "dossier.write");
    const dossiers = [...new Map(input.dossiers.map((d) => [d.dossierId, d])).values()];
    if (dossiers.length === 0) throw new DomainError("dossiers_required", "Chọn ít nhất một hồ sơ để phân công");
    const members = unique(input.members);
    const advisors = unique(input.advisors);
    if (members.some((id) => advisors.includes(id))) throw conflictOfRoles();
    const desired = new Map<string, AssignmentKind>([...members.map((id) => [id, "member"] as const), ...advisors.map((id) => [id, "advisory"] as const)]);

    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const eligible = new Map<string, { member: Set<string>; advisory: Set<string> }>();
      const out: { dossierId: string; version: number }[] = [];
      // Locked in id order, so two Thư ký editing overlapping sets queue rather than deadlock.
      for (const d of [...dossiers].sort((a, b) => a.dossierId.localeCompare(b.dossierId))) {
        const before = await lockDossier(tx, actor, d.dossierId);
        // transition() first, so a wrong state, Vai trò, version or a hồ sơ not Tiếp nhận is reported as such.
        const after = await transition(deps, tx, actor, before, {
          action: "dossier.assignment.edit",
          expectedVersion: d.expectedVersion,
          metadata: { members, advisors },
        });
        const councilId = before.councilId!;
        if (!eligible.has(councilId)) eligible.set(councilId, await eligibleOf(tx, councilId, now));
        checkEligible(eligible.get(councilId)!, members, advisors);
        await replaceDrafts(deps, tx, actor.userId, before.id, desired, now);
        out.push({ dossierId: before.id, version: after.version });
      }
      // In the order asked for.
      return { dossiers: dossiers.map((d) => out.find((o) => o.dossierId === d.dossierId)!) };
    });
  };
}

/** The Người dùng with a Phân vai Thành viên hội đồng or Thành viên Tổ tư vấn in force on the Hội đồng at `now`. */
export async function eligibleOf(tx: Tx, councilId: string, now: Date) {
  const members = await councilMembers(tx, councilId, now);
  return {
    member: new Set(members.council_member.map((m) => m.userId)),
    advisory: new Set(members.advisory_member.map((m) => m.userId)),
  };
}

export function checkEligible(eligible: { member: Set<string>; advisory: Set<string> }, members: string[], advisors: string[]) {
  if (members.some((id) => !eligible.member.has(id))) {
    throw new DomainError("not_council_member", "Chỉ chọn được người có Phân vai Thành viên hội đồng còn hiệu lực của hội đồng");
  }
  if (advisors.some((id) => !eligible.advisory.has(id))) {
    throw new DomainError("not_advisory_member", "Chỉ chọn được người có Phân vai Thành viên Tổ tư vấn còn hiệu lực của hội đồng");
  }
}

export const conflictOfRoles = () =>
  new DomainError("conflict_of_roles", "Một người không thể vừa là Thành viên Tổ tư vấn vừa là thành viên chấm của cùng một hồ sơ");

async function replaceDrafts(deps: CoreDeps, tx: Tx, by: string, dossierId: string, desired: Map<string, AssignmentKind>, now: Date) {
  // Story 28: a Phân công replaced earlier still counts; one person never holds both roles on a hồ sơ.
  if ((await tx.assignments.replaced(dossierId)).some((a) => desired.has(a.userId) && desired.get(a.userId) !== a.kind)) throw conflictOfRoles();
  const current = await tx.assignments.current(dossierId);
  const kept = new Set<string>();
  const drop: string[] = [];
  for (const a of current) {
    if (desired.get(a.userId) === a.kind) kept.add(a.userId);
    else if (a.effectiveAt !== null) {
      throw new DomainError("assignment_in_force", "Phân công đã có hiệu lực không sửa ở đây được; hãy dùng thay thế thành viên");
    } else drop.push(a.id);
  }
  await tx.assignments.deleteDrafts(drop);
  for (const [userId, kind] of desired) {
    if (kept.has(userId)) continue;
    const a: Assignment = {
      id: deps.ids.next(),
      dossierId,
      userId,
      kind,
      createdBy: by,
      createdAt: now,
      effectiveAt: null,
      replacedAt: null,
      replacedBy: null,
      replaceReason: null,
    };
    await tx.assignments.insert(a);
  }
}

/** L09 HD-02: the current Phân công of a hồ sơ of the Hội đồng, nháp or in force, for its Chủ tịch and Thư ký. */
export function listAssignments(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<AssignmentView[]> => {
    authorize(actor, "dossier.assignment.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      if (!(await tx.dossiers.findById(scope, input.dossierId))) throw dossierNotFound();
      const views: AssignmentView[] = [];
      for (const a of await tx.assignments.current(input.dossierId)) {
        const user = await tx.users.findById(a.userId);
        views.push({ userId: a.userId, fullName: user?.fullName ?? "", kind: a.kind, effectiveAt: a.effectiveAt, createdAt: a.createdAt });
      }
      return views;
    });
  };
}

/**
 * L09 HD-02 (stories 25, 26): whom the Thư ký may choose, the Phân vai Thành viên hội đồng and Thành viên
 * Tổ tư vấn in force now on the Hội đồng of the Vai trò đang dùng.
 */
export function assignmentCandidates(deps: CoreDeps) {
  return async (actor: Actor): Promise<{ members: AssignmentCandidate[]; advisors: AssignmentCandidate[] }> => {
    authorize(actor, "dossier.assignment.read");
    const councilId = actor.activeScope?.type === "council" ? actor.activeScope.id : null;
    if (!councilId || !isUuid(councilId)) return { members: [], advisors: [] };
    return deps.uow.run(async (tx) => {
      const members = await councilMembers(tx, councilId, deps.clock.now());
      const pick = (m: { userId: string; fullName: string }) => ({ userId: m.userId, fullName: m.fullName });
      return { members: members.council_member.map(pick), advisors: members.advisory_member.map(pick) };
    });
  };
}
