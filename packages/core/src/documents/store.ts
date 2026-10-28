import { createHash } from "node:crypto";
import { auditEntry } from "../audit/audit";
import type { UserActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import type { Tx } from "../shared/uow";
import { DOCX_TYPE } from "./renderer";

/**
 * Stores a văn bản the server generated as a `generated_document` file, `clean` at once since it never
 * came from outside. Each call writes a new object under a new id, so a stored văn bản never changes:
 * a later template or a later nộp produces another file. The caller references the id in the same
 * transaction; should that transaction roll back, the object is deleted with it.
 */
export async function storeGeneratedDocument(
  deps: CoreDeps,
  tx: Tx,
  actor: UserActor,
  input: { fileName: string; bytes: Uint8Array; metadata: Record<string, unknown>; contentType?: string },
): Promise<string> {
  const contentType = input.contentType ?? DOCX_TYPE;
  const id = deps.ids.next();
  const storageKey = `files/${id}`;
  const now = deps.clock.now();
  tx.onRollback(() => deps.files.delete(storageKey));
  await deps.files.put(storageKey, input.bytes, contentType);
  await tx.files.insert({
    id,
    ownerUserId: actor.userId,
    purpose: "generated_document",
    storageKey,
    fileName: input.fileName,
    declaredType: contentType,
    size: input.bytes.byteLength,
    multipartUploadId: null,
    status: "clean",
    detectedType: contentType,
    sha256: createHash("sha256").update(input.bytes).digest("hex"),
    blockReason: null,
    createdAt: now,
    uploadedAt: now,
    scannedAt: now,
  });
  await tx.audit.append(
    auditEntry(actor, deps.ids.next(), now, {
      action: "file.generated",
      targetType: "file",
      targetId: id,
      after: { fileName: input.fileName, size: input.bytes.byteLength },
      metadata: input.metadata,
    }),
  );
  return id;
}
