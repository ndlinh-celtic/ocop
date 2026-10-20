import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import type { Actor, UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape, isUuid } from "../shared/ids";
import type { Tx } from "../shared/uow";
import { dossierNotFound, PRODUCT_FIELDS, type Dossier, type ProductInfo } from "./model";
import { transition } from "./transition";

/** Loads a hồ sơ within the actor's Phạm vi, row-locked for the rest of the transaction. */
export async function lockDossier(tx: Tx, actor: UserActor, dossierId: unknown): Promise<Dossier> {
  assertIdShape(dossierId, dossierNotFound);
  const dossier = await tx.dossiers.lock(dataScopeOf(actor), dossierId);
  if (!dossier) throw dossierNotFound();
  return dossier;
}

const MAX_FIELD = 10_000;

export interface UpdateProductInput extends Partial<ProductInfo> {
  dossierId: string;
  expectedVersion: number;
}

/**
 * L02 CT-03 (stories 18, 19): saves thông tin sản phẩm, as often as the editor autosaves. Only the
 * fields sent change. Allowed where the transition table has a `dossier.edit` row: a Nháp (and, from #39,
 * Yêu cầu bổ sung). Returns the new version for the next save.
 */
export function updateProduct(deps: CoreDeps) {
  return async (actor: Actor, input: UpdateProductInput): Promise<{ version: number }> => {
    authorize(actor, "dossier.read");
    const patch: Partial<ProductInfo> = {};
    for (const field of PRODUCT_FIELDS) {
      const value = input[field];
      if (value === undefined) continue;
      if (typeof value !== "string" || value.length > MAX_FIELD) throw new DomainError("field_too_long", "Nội dung quá dài");
      patch[field] = value.trim();
    }
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const changed = PRODUCT_FIELDS.filter((f) => patch[f] !== undefined && patch[f] !== before[f]);
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.edit",
        expectedVersion: input.expectedVersion,
        patch,
        metadata: { changed },
      });
      return { version: after.version };
    });
  };
}

/**
 * Puts a file the Chủ thể uploaded (purpose `evidence`) into the kho minh chứng of its hồ sơ. Tying it
 * to Tiêu chí, and removing it, are #35.
 */
export function addEvidenceFile(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number; fileId: string }): Promise<{ version: number }> => {
    authorize(actor, "dossier.read");
    return deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      const file = isUuid(input.fileId) ? await tx.files.findById(input.fileId) : null;
      if (!file || file.ownerUserId !== actor.userId || file.purpose !== "evidence") throw new DomainError("file_required", "Tải lên tệp minh chứng");
      if (file.status === "awaiting_upload") throw new DomainError("file_not_uploaded", "Tệp chưa được tải lên xong");
      if (file.status === "blocked") throw new DomainError("file_blocked", "Tệp đã bị chặn khi quét, hãy tải lên tệp khác");
      const after = await transition(deps, tx, actor, before, {
        action: "dossier.evidence.add",
        expectedVersion: input.expectedVersion,
        metadata: { fileId: file.id },
      });
      if (!(await tx.dossiers.addEvidence({ dossierId: after.id, fileId: file.id, addedBy: actor.userId, addedAt: after.updatedAt }))) {
        throw new DomainError("file_already_added", "Tệp này đã có trong kho minh chứng của hồ sơ");
      }
      return { version: after.version };
    });
  };
}

/** Story 26: deletes a Nháp that was never submitted. It disappears from every list; its events stay. */
export function deleteDossier(deps: CoreDeps) {
  return async (actor: Actor, input: { dossierId: string; expectedVersion: number }): Promise<void> => {
    authorize(actor, "dossier.read");
    await deps.uow.run(async (tx) => {
      const before = await lockDossier(tx, actor, input.dossierId);
      await transition(deps, tx, actor, before, {
        action: "dossier.delete",
        expectedVersion: input.expectedVersion,
        patch: { deletedAt: deps.clock.now() },
      });
    });
  };
}
