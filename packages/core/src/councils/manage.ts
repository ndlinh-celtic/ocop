import { auditEntry } from "../audit/audit";
import { isAssignmentActive } from "../identity/model";
import { authorize } from "../identity/policy";
import { emit } from "../platform/emit";
import { endOfVnDay } from "../rounds/model";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import type { Council } from "./model";

/** What Cán bộ Sở fills in from the quyết định thành lập (stories 1, 4). */
export interface CouncilInput {
  name: string;
  decisionNumber: string;
  /** Ngày quyết định, a calendar date YYYY-MM-DD. */
  decisionDate: string;
  /** A file the actor uploaded with purpose `council_decision`. */
  decisionFileId: string;
}

export const councilNotFound = () => new DomainError("not_found", "Không tìm thấy hội đồng");

/** The Hội đồng, row-locked for the rest of the transaction, or `not_found`. */
export async function lockCouncil(tx: Tx, councilId: string): Promise<Council> {
  assertIdShape(councilId, councilNotFound);
  const council = await tx.councils.lock(councilId);
  if (!council) throw councilNotFound();
  return council;
}

async function checkedFields(tx: Tx, actor: { userId: string }, input: CouncilInput, current?: Council) {
  const name = input.name.trim();
  if (!name) throw new DomainError("name_required", "Nhập tên hội đồng");
  const decisionNumber = input.decisionNumber.trim();
  if (!decisionNumber) throw new DomainError("decision_number_required", "Nhập số quyết định thành lập");
  endOfVnDay(input.decisionDate);
  // Keeping the quyết định already recorded needs no new upload; a different one must be the actor's own.
  if (input.decisionFileId !== current?.decisionFileId) {
    const fileRequired = () => new DomainError("decision_file_required", "Tải lên tệp quyết định thành lập");
    assertIdShape(input.decisionFileId, fileRequired);
    const file = await tx.files.findById(input.decisionFileId);
    if (!file || file.ownerUserId !== actor.userId || file.purpose !== "council_decision") throw fileRequired();
    if (file.status === "awaiting_upload") throw new DomainError("file_not_uploaded", "Tệp chưa được tải lên xong");
    if (file.status === "blocked") throw new DomainError("file_blocked", "Tệp đã bị chặn khi quét, hãy tải lên tệp khác");
  }
  return { name, decisionNumber, decisionDate: input.decisionDate, decisionFileId: input.decisionFileId };
}

/** What the audit log keeps of a Hội đồng. */
const describeCouncil = (c: Council) => ({
  name: c.name,
  decisionNumber: c.decisionNumber,
  decisionDate: c.decisionDate,
  decisionFileId: c.decisionFileId,
  leaderUserId: c.leaderUserId,
});

/** L09 HD-01 story 1: Cán bộ Sở records a Hội đồng from its quyết định thành lập. */
export function createCouncil(deps: CoreDeps) {
  return async (actor: Actor, input: CouncilInput): Promise<{ councilId: string }> => {
    authorize(actor, "council.manage");
    return deps.uow.run(async (tx) => {
      const fields = await checkedFields(tx, actor, input);
      const now = deps.clock.now();
      const council: Council = { id: deps.ids.next(), ...fields, leaderUserId: null, createdAt: now, createdBy: actor.userId, updatedAt: now };
      await tx.councils.insert(council);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, { action: "council.created", targetType: "council", targetId: council.id, after: describeCouncil(council) }),
      );
      await emit(deps, tx, { type: "council.created", payload: { councilId: council.id } });
      return { councilId: council.id };
    });
  };
}

/** L09 HD-01 story 4: Cán bộ Sở corrects the tên, số, ngày or tệp quyết định of a Hội đồng. */
export function updateCouncil(deps: CoreDeps) {
  return async (actor: Actor, input: CouncilInput & { councilId: string }): Promise<void> => {
    authorize(actor, "council.manage");
    return deps.uow.run(async (tx) => {
      const before = await lockCouncil(tx, input.councilId);
      const now = deps.clock.now();
      const after: Council = { ...before, ...(await checkedFields(tx, actor, input, before)), updatedAt: now };
      await tx.councils.update(after);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "council.updated",
          targetType: "council",
          targetId: after.id,
          before: describeCouncil(before),
          after: describeCouncil(after),
        }),
      );
      await emit(deps, tx, { type: "council.updated", payload: { councilId: after.id } });
    });
  };
}

/**
 * L09 HD-01 stories 2, 3: Cán bộ Sở names or changes the Tổ trưởng. Only a Người dùng holding a Phân vai
 * Thành viên Tổ tư vấn in force on this Hội đồng may be chosen; issuing a Báo cáo Tổ tư vấn checks it again.
 */
export function setCouncilLeader(deps: CoreDeps) {
  return async (actor: Actor, input: { councilId: string; userId: string }): Promise<void> => {
    authorize(actor, "council.manage");
    return deps.uow.run(async (tx) => {
      const before = await lockCouncil(tx, input.councilId);
      const now = deps.clock.now();
      const notAdvisor = () => new DomainError("leader_not_advisory_member", "Tổ trưởng phải là Thành viên Tổ tư vấn còn hiệu lực của hội đồng");
      assertIdShape(input.userId, notAdvisor);
      const advisors = await tx.roleAssignments.listForScope("advisory_member", "council", before.id);
      if (!advisors.some((a) => a.userId === input.userId && isAssignmentActive(a, now))) throw notAdvisor();
      if (before.leaderUserId === input.userId) return;
      const after: Council = { ...before, leaderUserId: input.userId, updatedAt: now };
      await tx.councils.update(after);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "council.leader_changed",
          targetType: "council",
          targetId: after.id,
          before: { leaderUserId: before.leaderUserId },
          after: { leaderUserId: after.leaderUserId },
        }),
      );
      await emit(deps, tx, {
        type: "council.leader_changed",
        payload: { councilId: after.id, fromUserId: before.leaderUserId, toUserId: input.userId },
      });
    });
  };
}
