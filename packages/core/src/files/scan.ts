import { auditEntry } from "../audit/audit";
import type { ConsumerContext } from "../platform/consumer-context";
import { emit } from "../platform/emit";
import { typeMatches } from "./inspection";

/**
 * Consumer: scans a file in quarantine (L24, mandatory ClamAV). The status changes in the database
 * only; the object is never copied. Scanner errors propagate so the job retries and the file stays
 * in quarantine.
 */
export async function scanUploadedFile(c: ConsumerContext): Promise<void> {
  if (c.event.type !== "files.uploaded") return;
  const { deps, tx } = c;
  const file = await tx.files.findById(c.event.payload.fileId);
  if (!file || file.status !== "scanning") return;

  const result = await deps.inspector.inspect(file.storageKey);
  const now = deps.clock.now();
  const blockReason = result.virus
    ? `Phát hiện mã độc (${result.virus})`
    : !typeMatches(file.declaredType, result.detectedType)
      ? `Nội dung không đúng định dạng khai báo (${result.detectedType ?? "không xác định"})`
      : null;

  await tx.files.update(file.id, {
    status: blockReason ? "blocked" : "clean",
    sha256: result.sha256,
    detectedType: result.detectedType,
    blockReason,
    scannedAt: now,
  });
  const system = { kind: "system" as const, name: c.consumer, ctx: { requestId: c.event.id } };
  await tx.audit.append(
    auditEntry(system, deps.ids.next(), now, {
      action: blockReason ? "file.blocked" : "file.scanned_clean",
      targetType: "file",
      targetId: file.id,
      metadata: { sha256: result.sha256, detectedType: result.detectedType, virus: result.virus, reason: blockReason },
    }),
  );
  if (blockReason) await emit(deps, tx, { type: "files.blocked", payload: { fileId: file.id } });
}

/** Consumer: tells the uploader their file was blocked. */
export async function notifyFileBlocked(c: ConsumerContext): Promise<void> {
  if (c.event.type !== "files.blocked") return;
  const file = await c.tx.files.findById(c.event.payload.fileId);
  if (!file) return;
  await c.tx.notifications.insert({
    id: c.deps.ids.next(),
    userId: file.ownerUserId,
    kind: "file_blocked",
    title: `Tệp ${file.fileName} bị chặn`,
    body: `${file.blockReason ?? "Tệp không an toàn"}. Kiểm tra lại tệp rồi tải lên bản khác.`,
    link: null,
    createdAt: c.deps.clock.now(),
    readAt: null,
  });
}
