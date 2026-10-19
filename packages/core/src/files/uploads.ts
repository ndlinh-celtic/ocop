import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import type { StoredFile } from "./model";

export type UploadInstructions =
  | { kind: "single"; url: string; headers: Record<string, string>; expiresAt: Date }
  | { kind: "multipart"; partSize: number; partUrls: string[]; expiresAt: Date };

const MB = 1024 * 1024;
const extension = (name: string) => name.toLowerCase().split(".").pop() ?? "";

function assertAcceptable(deps: CoreDeps, input: { fileName: string; contentType: string; size: number }) {
  const { allowedTypes, maxBytes } = deps.settings.files;
  const exts = allowedTypes[input.contentType];
  if (!exts || !exts.includes(extension(input.fileName))) {
    throw new DomainError("file_type_not_allowed", "Định dạng tệp không được chấp nhận");
  }
  if (!Number.isInteger(input.size) || input.size <= 0) throw new DomainError("file_empty", "Tệp rỗng");
  if (input.size > maxBytes) throw new DomainError("file_too_large", `Tệp vượt quá ${Math.round(maxBytes / MB)} MB`);
}

/**
 * Registers a file and returns how the browser uploads it: one presigned PUT, or presigned parts
 * above the multipart threshold. Type and size are checked before any URL is issued.
 */
export function requestUpload(deps: CoreDeps) {
  return async (actor: Actor, input: { fileName: string; contentType: string; size: number }) => {
    authorize(actor, "file.test_upload");
    const fileName = input.fileName.trim().slice(0, 255);
    assertAcceptable(deps, { ...input, fileName });
    const s = deps.settings.files;
    const id = deps.ids.next();
    const storageKey = `files/${id}`;
    let upload: UploadInstructions;
    let multipartUploadId: string | null = null;
    if (input.size > s.multipartThresholdBytes) {
      multipartUploadId = await deps.files.startMultipart(storageKey, input.contentType);
      const count = Math.ceil(input.size / s.partSizeBytes);
      const parts = await Promise.all(Array.from({ length: count }, (_, i) => deps.files.presignPart(storageKey, multipartUploadId!, i + 1, s.uploadUrlTtlSec)));
      upload = { kind: "multipart", partSize: s.partSizeBytes, partUrls: parts.map((p) => p.url), expiresAt: parts[0]!.expiresAt };
    } else {
      const put = await deps.files.presignPut(storageKey, { contentType: input.contentType, contentLength: input.size, expiresInSec: s.uploadUrlTtlSec });
      upload = { kind: "single", url: put.url, headers: put.headers, expiresAt: put.expiresAt };
    }
    await deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const file: StoredFile = {
        id,
        ownerUserId: actor.userId,
        purpose: "test_upload",
        storageKey,
        fileName,
        declaredType: input.contentType,
        size: input.size,
        multipartUploadId,
        status: "awaiting_upload",
        detectedType: null,
        sha256: null,
        blockReason: null,
        createdAt: now,
        uploadedAt: null,
        scannedAt: null,
      };
      await tx.files.insert(file);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "file.upload_requested",
          targetType: "file",
          targetId: id,
          after: { fileName, declaredType: input.contentType, size: input.size },
        }),
      );
    });
    return { fileId: id, upload };
  };
}

/** The browser reports the upload finished; storage must hold exactly the declared size. */
export function completeUpload(deps: CoreDeps) {
  return async (actor: Actor, fileId: string, parts?: { partNumber: number; etag: string }[]) => {
    authorize(actor, "file.test_upload");
    const file = await deps.uow.run((tx) => tx.files.findById(fileId));
    if (!file || file.ownerUserId !== actor.userId) throw new DomainError("not_found", "Không tìm thấy tệp");
    if (file.status !== "awaiting_upload") throw new DomainError("already_uploaded", "Tệp đã được tải lên");
    if (file.multipartUploadId) {
      if (!parts?.length) throw new DomainError("upload_missing", "Chưa nhận được nội dung tệp");
      await deps.files.completeMultipart(file.storageKey, file.multipartUploadId, parts);
    }
    const head = await deps.files.head(file.storageKey);
    if (!head) throw new DomainError("upload_missing", "Chưa nhận được nội dung tệp");
    if (head.size !== file.size) throw new DomainError("upload_size_mismatch", "Kích thước tệp không khớp");
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      // No scanner yet: the next step puts the file in quarantine ("scanning") until it is scanned.
      await tx.files.update(file.id, { status: "clean", uploadedAt: now });
      await tx.audit.append(auditEntry(actor, deps.ids.next(), now, { action: "file.uploaded", targetType: "file", targetId: file.id, metadata: { size: head.size } }));
    });
  };
}

/** A short-lived download link, only for a file that is clean and that the actor may see. */
export function requestDownload(deps: CoreDeps) {
  return async (actor: Actor, fileId: string) => {
    authorize(actor, "file.test_upload");
    return deps.uow.run(async (tx) => {
      const file = await tx.files.findById(fileId);
      if (!file || file.ownerUserId !== actor.userId) throw new DomainError("not_found", "Không tìm thấy tệp");
      if (file.status !== "clean") throw new DomainError("file_not_ready", "Tệp chưa sẵn sàng để tải xuống");
      const get = await deps.files.presignGet(file.storageKey, { fileName: file.fileName, expiresInSec: deps.settings.files.downloadUrlTtlSec });
      await tx.audit.append(auditEntry(actor, deps.ids.next(), deps.clock.now(), { action: "file.download_issued", targetType: "file", targetId: file.id }));
      return { url: get.url, expiresAt: get.expiresAt };
    });
  };
}

export function listFiles(deps: CoreDeps) {
  return async (actor: Actor) => {
    authorize(actor, "file.test_upload");
    return deps.uow.run((tx) => tx.files.listByOwner(actor.userId, 50));
  };
}
