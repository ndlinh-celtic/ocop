import { auditEntry, type AuditActor } from "../audit/audit";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import type { Tx } from "../shared/uow";

/**
 * A short-lived link to a stored file the caller has already allowed the actor to see: the file must exist (else
 * `notFound`) and be scanned clean (else `file_not_ready`); the link is audited `file.download_issued` with `metadata`.
 */
export async function issueFileDownload(
  deps: CoreDeps,
  tx: Tx,
  actor: AuditActor,
  fileId: string | null | undefined,
  notFound: () => Error,
  metadata: Record<string, unknown>,
): Promise<{ url: string; expiresAt: Date }> {
  const file = fileId ? await tx.files.findById(fileId) : null;
  if (!file) throw notFound();
  if (file.status !== "clean") throw new DomainError("file_not_ready", "Tệp chưa sẵn sàng để tải xuống");
  const get = await deps.files.presignGet(file.storageKey, { fileName: file.fileName, expiresInSec: deps.settings.files.downloadUrlTtlSec });
  await tx.audit.append(
    auditEntry(actor, deps.ids.next(), deps.clock.now(), { action: "file.download_issued", targetType: "file", targetId: file.id, metadata }),
  );
  return { url: get.url, expiresAt: get.expiresAt };
}
