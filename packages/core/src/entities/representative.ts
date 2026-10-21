import { isAssignmentActive, type User } from "../identity/model";
import type { Tx } from "../shared/uow";

/**
 * The Người dùng đại diện of a Chủ thể: who holds its current Phân vai entity_owner, the first one granted
 * when there are several. Null only if every such Phân vai has ended.
 */
export async function representativeOf(tx: Tx, entityId: string, now: Date): Promise<User | null> {
  const current = (await tx.roleAssignments.listForScope("entity_owner", "entity", entityId)).find((a) => isAssignmentActive(a, now));
  return current ? tx.users.findById(current.userId) : null;
}
