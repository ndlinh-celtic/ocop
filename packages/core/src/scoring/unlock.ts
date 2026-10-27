import { ownUpload } from "../files/attach";
import { dossierNotFound, versionConflict, type DossierState } from "../dossiers/model";
import { transitionByLookup } from "../dossiers/transition";
import { authorize } from "../identity/policy";
import { requireRecentAuth } from "../identity/reauth";
import { dataScopeOf } from "../identity/scope";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import type { Tx } from "../shared/uow";
import type { UnlockRequest } from "./meeting-model";

/*
 * L15 Mở khóa sau chốt (spec #49 stories 127 to 133, ADR 0008). Quản trị has no DataScope over hồ sơ and reads no
 * điểm: it finds a hồ sơ by mã through a narrow lookup that gives back the mã and state only, and Mở khóa it on the
 * Hội đồng's văn bản yêu cầu, after Xác thực lại. The hồ sơ goes back to Sẵn sàng chốt, the kết quả chốt hiện hành
 * is marked superseded by the request, and no phiếu changes: the Chủ tịch or Thư ký Trả phiếu whoever must grade
 * again, then chốt again in a new Phiên họp, which writes kết quả n + 1.
 */

const MAX_FIELD = 2_000;

/** A Mở khóa sau chốt as Quản trị and the Hội đồng see it. */
export interface UnlockView {
  id: string;
  /** The kết quả chốt it superseded. */
  n: number;
  requestedBy: string;
  reason: string;
  requestFileId: string;
  unlockedAt: Date;
  unlockedBy: { userId: string; fullName: string };
  reauthMethod: "totp" | "password";
}

/** What Quản trị sees of a hồ sơ: its mã, its state and the Mở khóa already done, nothing of its content. */
export interface UnlockTarget {
  dossierId: string;
  code: string;
  state: DossierState;
  unlocks: UnlockView[];
}

/** A kết quả chốt in the history of a hồ sơ (S43): the current one and those a Mở khóa superseded. */
export interface FinalizedResultSummary {
  id: string;
  n: number;
  total: number;
  star: number;
  sha256: string;
  finalizedAt: Date;
  supersededAt: Date | null;
  unlock: UnlockView | null;
}

async function unlockViews(tx: Tx, dossierId: string): Promise<UnlockView[]> {
  const results = new Map((await tx.aggregateResults.list(dossierId)).map((r) => [r.id, r.n]));
  const views: UnlockView[] = [];
  for (const u of await tx.aggregateResults.unlocks(dossierId)) views.push(await viewOf(tx, u, results.get(u.resultId) ?? 0));
  return views;
}

const viewOf = async (tx: Tx, u: UnlockRequest, n: number): Promise<UnlockView> => ({
  id: u.id,
  n,
  requestedBy: u.requestedBy,
  reason: u.reason,
  requestFileId: u.requestFileId,
  unlockedAt: u.unlockedAt,
  unlockedBy: { userId: u.unlockedBy, fullName: (await tx.users.findById(u.unlockedBy))?.fullName ?? "" },
  reauthMethod: u.reauthMethod,
});

/** Story 127: the hồ sơ of a mã, for Quản trị; a mã that names none is not_found. */
export function unlockTarget(deps: CoreDeps) {
  return async (actor: Actor, input: { code: string }): Promise<UnlockTarget> => {
    authorize(actor, "scoring.unlock");
    const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
    if (!code || code.length > 40) throw dossierNotFound();
    return deps.uow.run(async (tx) => {
      const row = await tx.dossiers.stateRow({ code });
      if (!row) throw dossierNotFound();
      return { dossierId: row.id, code: row.code, state: row.state, unlocks: await unlockViews(tx, row.id) };
    });
  };
}

export interface UnlockInput {
  dossierId: string;
  /** The văn bản yêu cầu of the Hội đồng: a PDF Quản trị uploaded with purpose `unlock_request`. */
  requestFileId: string;
  /** Who asked, as the văn bản names them (họ tên, chức vụ). */
  requestedBy: string;
  reason: string;
}

const required = (value: unknown, code: string, message: string) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new DomainError(code, message);
  if (text.length > MAX_FIELD) throw new DomainError("field_too_long", "Nội dung quá dài");
  return text;
};

/** Stories 127 to 131: Mở khóa sau chốt, in one transaction with its audit row and outbox event. */
export function unlockFinalized(deps: CoreDeps) {
  return async (actor: Actor, input: UnlockInput): Promise<{ unlockId: string; dossierState: DossierState; supersededN: number }> => {
    authorize(actor, "scoring.unlock");
    const requestedBy = required(input.requestedBy, "requested_by_required", "Cần ghi người yêu cầu Mở khóa");
    const reason = required(input.reason, "reason_required", "Cần nêu lý do Mở khóa");
    assertIdShape(input.dossierId, dossierNotFound);
    return deps.uow.run(async (tx) => {
      const before = await tx.dossiers.stateRow({ id: input.dossierId }, true);
      if (!before) throw dossierNotFound();
      const proof = await requireRecentAuth(deps, tx, actor);
      const file = await ownUpload(
        tx,
        actor,
        input.requestFileId,
        "unlock_request",
        () => new DomainError("file_required", "Tải lên văn bản yêu cầu Mở khóa của Hội đồng (PDF)"),
      );

      const result = before.state === "score_finalized" ? await tx.aggregateResults.current(before.id) : null;
      const now = deps.clock.now();
      const unlockId = deps.ids.next();
      // The row decides first, so a hồ sơ not Đã chốt điểm is refused as such (story 131).
      const after = await transitionByLookup(deps, tx, actor, before, {
        action: "dossier.unlock",
        expectedVersion: before.version,
        reason,
        metadata: {
          unlockId,
          resultId: result?.id ?? null,
          n: result?.n ?? null,
          requestFileId: file.id,
          requestedBy,
          reauth: { at: proof.at.toISOString(), method: proof.method },
        },
      });
      if (!result) throw new DomainError("result_not_found", "Hồ sơ không có kết quả chốt hiện hành");
      await tx.aggregateResults.insertUnlock({
        id: unlockId,
        dossierId: before.id,
        resultId: result.id,
        requestFileId: file.id,
        requestedBy,
        reason,
        unlockedBy: actor.userId,
        unlockedAt: now,
        reauthMethod: proof.method,
      });
      // Story 128: the kết quả stays as it was, superseded; story 129: no phiếu is touched.
      if (!(await tx.aggregateResults.supersede(result.id, now, unlockId))) throw versionConflict();
      return { unlockId, dossierState: after.state, supersededN: result.n };
    });
  };
}

/** Story 130: every kết quả chốt of a hồ sơ of the Hội đồng, n ascending, with the Mở khóa that superseded it. */
export function finalizedResults(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string }): Promise<FinalizedResultSummary[]> => {
    authorize(actor, "scoring.result.read");
    assertIdShape(input.dossierId, dossierNotFound);
    return deps.uow.run(async (tx) => {
      const dossier = await tx.dossiers.findById(dataScopeOf(actor), input.dossierId);
      if (!dossier) throw dossierNotFound();
      const unlocks = await unlockViews(tx, dossier.id);
      return (await tx.aggregateResults.list(dossier.id)).map((r) => ({
        id: r.id,
        n: r.n,
        total: r.total,
        star: r.star,
        sha256: r.sha256,
        finalizedAt: r.finalizedAt,
        supersededAt: r.supersededAt,
        unlock: unlocks.find((u) => u.id === r.supersededByUnlock) ?? null,
      }));
    });
  };
}
