import type { SupplementItem, SupplementRepo, SupplementRequest } from "@ocop/core";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "../db/types";
import { supplementItem, supplementRequest } from "../db/schema";

/** Yêu cầu bổ sung of a hồ sơ the core has already loaded within the reader's scope. */
export function supplementRepo(db: Db): SupplementRepo {
  async function withItems(requests: Omit<SupplementRequest, "items">[]): Promise<SupplementRequest[]> {
    if (requests.length === 0) return [];
    const items = (await db
      .select()
      .from(supplementItem)
      .where(
        inArray(
          supplementItem.requestId,
          requests.map((r) => r.id),
        ),
      )
      .orderBy(asc(supplementItem.position))) as SupplementItem[];
    return requests.map((r) => ({ ...r, items: items.filter((i) => i.requestId === r.id) }));
  }

  return {
    async insert({ items, ...request }) {
      await db.insert(supplementRequest).values(request);
      await db.insert(supplementItem).values(items);
    },
    async list(dossierId) {
      const rows = await db
        .select()
        .from(supplementRequest)
        .where(eq(supplementRequest.dossierId, dossierId))
        .orderBy(asc(supplementRequest.requestedAt), asc(supplementRequest.id));
      return withItems(rows);
    },
    async findOpen(dossierId) {
      const rows = await db
        .select()
        .from(supplementRequest)
        .where(and(eq(supplementRequest.dossierId, dossierId), isNull(supplementRequest.closedAt)));
      return (await withItems(rows))[0] ?? null;
    },
    async respond(itemId, answer) {
      await db.update(supplementItem).set(answer).where(eq(supplementItem.id, itemId));
    },
    async close(requestId, closedAt, outcome) {
      await db.update(supplementRequest).set({ closedAt, outcome }).where(eq(supplementRequest.id, requestId));
    },
  };
}
