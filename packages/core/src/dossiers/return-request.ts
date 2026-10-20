import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import { lockDossier } from "./edit";
import { dossierNotFound, type ReturnRequest } from "./model";
import { transition } from "./transition";

/*
 * L04 (#44, story 59): a Cán bộ xã who finds a mistake in a hồ sơ already gửi tỉnh asks the Sở to trả về
 * it, with a lý do. Nothing about the hồ sơ changes: the Sở decides, and its trả về is returnFromProvince.
 */

const MAX_REASON = 2_000;

/** Story 59: sends the Sở a đề nghị trả về of a hồ sơ Đã chuyển tỉnh, with its lý do. */
export function requestReturn(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number; reason: string }): Promise<{ version: number }> => {
    authorize(actor, "dossier.read");
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (reason === "") throw new DomainError("reason_required", "Nhập lý do đề nghị trả về");
    if (reason.length > MAX_REASON) throw new DomainError("field_too_long", "Lý do quá dài");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.return_request",
        expectedVersion: input.expectedVersion,
        metadata: { reason },
      });
      await tx.dossiers.insertReturnRequest({ id: deps.ids.next(), dossierId: before.id, reason, requestedBy: actor.userId, requestedAt: after.updatedAt });
      return { version: after.version };
    });
  };
}

export interface ReturnRequestView extends Omit<ReturnRequest, "requestedBy"> {
  requestedBy: { userId: string; fullName: string };
  /** Sent since the hồ sơ was last gửi tỉnh, and the Sở has not trả về it since. */
  pending: boolean;
}

/** Story 59: the đề nghị trả về of a hồ sơ within the reader's Phạm vi, oldest first, for the xã and the Sở. */
export function listReturnRequests(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<ReturnRequestView[]> => {
    authorize(actor, "dossier.return_request.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      const requests = await tx.dossiers.returnRequests(dossier.id);
      if (requests.length === 0) return [];
      const lastForward = (await tx.dossiers.events(scope, dossier.id)).findLast((e) => e.action === "dossier.forward")?.occurredAt;
      const names = new Map<string, string>();
      for (const id of new Set(requests.map((r) => r.requestedBy))) names.set(id, (await tx.users.findById(id))?.fullName ?? "");
      return requests.map((r) => ({
        ...r,
        requestedBy: { userId: r.requestedBy, fullName: names.get(r.requestedBy) ?? "" },
        pending: dossier.state === "forwarded_to_province" && !!lastForward && r.requestedAt >= lastForward,
      }));
    });
  };
}
