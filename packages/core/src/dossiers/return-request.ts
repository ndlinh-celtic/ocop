import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { lockDossier } from "./edit";
import { DOSSIER_STATES, dossierNotFound, type DossierState, type ReturnRequest } from "./model";
import { transition } from "./transition";
import { ruleFor } from "./transitions";

/*
 * L04 (#44, story 59): a Cán bộ xã who finds a mistake in a hồ sơ already gửi tỉnh asks the Sở to trả về
 * it, with a lý do. Nothing about the hồ sơ changes: the Sở decides, and its trả về is returnFromProvince.
 */

const MAX_REASON = 2_000;

/** Story 59: sends the Sở a đề nghị trả về of a hồ sơ Đã chuyển tỉnh, with its lý do. */
export function requestReturn(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number; reason: string }): Promise<{ version: number }> => {
    authorize(actor, "dossier.write");
    const reason = reasonOf(input.reason);
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
      return withNames(tx, requests, (r) => dossier.state === "forwarded_to_province" && !!lastForward && r.requestedAt >= lastForward);
    });
  };
}

/*
 * L10 TM-03 (#57, spec #49 stories 51 to 53; #69): while it thẩm định a hồ sơ, or once its báo cáo is issued but not
 * yet sao chép, a Thành viên Tổ tư vấn Phân công on it asks the Sở to trả về the hồ sơ to the xã, with a lý do. As with the xã's đề nghị, nothing about the hồ sơ
 * changes: the Sở decides, and its trả về is returnFromProvince. Only the Sở and the Tổ tư vấn read them.
 */

/**
 * The states a Thành viên Tổ tư vấn can đề nghị trả về in, read off the transition table so the table stays the one
 * place that says until when (the first sao chép, #69). The Sở's hồ sơ list filters by the same list.
 */
export const ADVISORY_RETURNABLE_STATES: readonly DossierState[] = DOSSIER_STATES.filter(
  (state) => ruleFor("dossier.advisory_return_request", state) !== undefined,
);

/** Story 51: sends the Sở a đề nghị trả về of a hồ sơ the Sở can still trả về, with its lý do. */
export function requestAdvisoryReturn(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number; reason: string }): Promise<{ version: number }> => {
    authorize(actor, "dossier.advisory_report.write");
    const reason = reasonOf(input.reason);
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.advisory_return_request",
        expectedVersion: input.expectedVersion,
        metadata: { reason },
      });
      await tx.dossiers.insertAdvisoryReturnRequest({
        id: deps.ids.next(),
        dossierId: before.id,
        reason,
        requestedBy: actor.userId,
        requestedAt: after.updatedAt,
      });
      return { version: after.version };
    });
  };
}

/**
 * Story 52: the đề nghị trả về of the Tổ tư vấn on a hồ sơ within the reader's Phạm vi, oldest first. One is
 * pending while the hồ sơ has not left the Giao chấm it was sent in and the Sở can still trả về it: Tổ tư vấn thẩm
 * định or Đã có báo cáo Tổ tư vấn, before the first sao chép (#69).
 */
export function listAdvisoryReturnRequests(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<ReturnRequestView[]> => {
    authorize(actor, "dossier.advisory_return_request.read");
    const scope = dataScopeOf(actor);
    return deps.uow.run(async (tx) => {
      assertIdShape(input.dossierId, dossierNotFound);
      const dossier = await tx.dossiers.findById(scope, input.dossierId);
      if (!dossier) throw dossierNotFound();
      const requests = await tx.dossiers.advisoryReturnRequests(dossier.id);
      const since = ADVISORY_RETURNABLE_STATES.includes(dossier.state) ? dossier.gradingStartedAt : null;
      return withNames(tx, requests, (r) => !!since && r.requestedAt >= since);
    });
  };
}

function reasonOf(value: unknown): string {
  const reason = typeof value === "string" ? value.trim() : "";
  if (reason === "") throw new DomainError("reason_required", "Nhập lý do đề nghị trả về");
  if (reason.length > MAX_REASON) throw new DomainError("field_too_long", "Lý do quá dài");
  return reason;
}

async function withNames(tx: Tx, requests: ReturnRequest[], pending: (r: ReturnRequest) => boolean): Promise<ReturnRequestView[]> {
  const names = new Map<string, string>();
  for (const id of new Set(requests.map((r) => r.requestedBy))) names.set(id, (await tx.users.findById(id))?.fullName ?? "");
  return requests.map((r) => ({ ...r, requestedBy: { userId: r.requestedBy, fullName: names.get(r.requestedBy) ?? "" }, pending: pending(r) }));
}
