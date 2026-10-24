import type { UserActor } from "../shared/context";
import { DomainError } from "../shared/errors";
import { isUuid } from "../shared/ids";
import type { Tx } from "../shared/uow";
import type { FilePurpose, StoredFile } from "./model";

/**
 * A file the actor uploaded for `purpose`, about to be attached to something: uploaded, and not refused by the
 * scan (it may still be scanning; downloads wait for `clean`). Any other id is reported by `notFound`.
 */
export async function ownUpload(tx: Tx, actor: UserActor, fileId: unknown, purpose: FilePurpose, notFound: () => Error): Promise<StoredFile> {
  const file = isUuid(fileId) ? await tx.files.findById(fileId) : null;
  if (!file || file.ownerUserId !== actor.userId || file.purpose !== purpose) throw notFound();
  if (file.status === "awaiting_upload") throw new DomainError("file_not_ready", "Tệp chưa được tải lên xong");
  if (file.status === "blocked") throw new DomainError("file_blocked", "Tệp đã bị chặn vì không an toàn, hãy tải lên bản khác");
  return file;
}
