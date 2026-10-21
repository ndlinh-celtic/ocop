import { isAssignmentActive, type User } from "../identity/model";
import { authorize } from "../identity/policy";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { isUuid } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { lockDossier } from "./edit";
import type { Dossier } from "./model";
import { transition } from "./transition";

/*
 * L05 XA-02, XA-03 (stories 40, 41, 43): the xã Tiếp nhận a hồ sơ Đã nộp xã and names its Cán bộ phụ
 * trách, who may be changed at any time afterwards. Neither moves the hồ sơ: both are same-state rows of
 * the transition table, so they carry the same version check, timeline row, audit and outbox.
 */

/** The Người dùng holding an active Phân vai Cán bộ xã on `wardId` at `now`, by name. */
export async function wardOfficersOf(tx: Tx, wardId: string, now: Date): Promise<User[]> {
  const assignments = (await tx.roleAssignments.listForScope("ward_officer", "ward", wardId)).filter((a) => isAssignmentActive(a, now));
  const users = await Promise.all([...new Set(assignments.map((a) => a.userId))].map((id) => tx.users.findById(id)));
  return users.filter((u): u is User => u !== null && u.status === "active").sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));
}

/** A Cán bộ phụ trách must be a Cán bộ xã of the hồ sơ's xã now. */
async function assertHandler(tx: Tx, dossier: Dossier, userId: unknown, now: Date): Promise<string> {
  const officers = dossier.wardId && isUuid(userId) ? await wardOfficersOf(tx, dossier.wardId, now) : [];
  if (!officers.some((u) => u.id === userId)) throw new DomainError("invalid_handler", "Cán bộ phụ trách phải là cán bộ của xã đang xử lý hồ sơ");
  return userId as string;
}

/**
 * L05 XA-02 (story 40): the xã Tiếp nhận a hồ sơ Đã nộp xã, recording when and by whom, and names its
 * Cán bộ phụ trách, the receiving Cán bộ xã unless another is chosen. From then on the Chủ thể can no
 * longer rút it (story 33).
 */
export function receiveDossier(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number; handlerUserId?: string | null }): Promise<{ version: number }> => {
    authorize(actor, "dossier.write");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const now = deps.clock.now();
      const handlerUserId = input.handlerUserId ? await assertHandler(tx, before, input.handlerUserId, now) : actor.userId;
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.receive",
        expectedVersion: input.expectedVersion,
        patch: { receivedAt: now, receivedBy: actor.userId, handlerUserId },
        metadata: { handlerUserId },
      });
      return { version: after.version };
    });
  };
}

/**
 * L05 XA-03 (story 41): any Cán bộ xã of the xã gives a received hồ sơ another Cán bộ phụ trách. Each
 * change is a row of the timeline, so the history of who handled it stays.
 */
export function changeHandler(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number; handlerUserId: string }): Promise<{ version: number }> => {
    authorize(actor, "dossier.write");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const handlerUserId = await assertHandler(tx, before, input.handlerUserId, deps.clock.now());
      if (handlerUserId === before.handlerUserId) throw new DomainError("handler_unchanged", "Cán bộ này đang là Cán bộ phụ trách hồ sơ");
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.handler.change",
        expectedVersion: input.expectedVersion,
        patch: { handlerUserId },
        metadata: { fromHandlerUserId: before.handlerUserId, handlerUserId },
      });
      return { version: after.version };
    });
  };
}

/** The Cán bộ xã of the actor's own xã, to choose a Cán bộ phụ trách from. */
export function listHandlers(deps: CoreDeps) {
  return async (actor: Actor): Promise<{ userId: string; fullName: string }[]> => {
    authorize(actor, "dossier.handler.list");
    const wardId = actor.activeScope?.type === "ward" ? actor.activeScope.id : null;
    if (!wardId) return [];
    return deps.uow.run(async (tx) => (await wardOfficersOf(tx, wardId, deps.clock.now())).map((u) => ({ userId: u.id, fullName: u.fullName })));
  };
}
