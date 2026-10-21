import type { RateLimitRepo } from "@ocop/core";
import { and, count, eq, gt } from "drizzle-orm";
import type { Db } from "../db/types";
import { rateLimitHit } from "../db/schema";

export function rateLimitRepo(db: Db): RateLimitRepo {
  return {
    async record(bucket, subjectHash, at) {
      await db.insert(rateLimitHit).values({ bucket, subjectHash, occurredAt: at });
    },
    async countSince(bucket, subjectHash, since) {
      const [row] = await db
        .select({ n: count() })
        .from(rateLimitHit)
        .where(and(eq(rateLimitHit.bucket, bucket), eq(rateLimitHit.subjectHash, subjectHash), gt(rateLimitHit.occurredAt, since)));
      return row?.n ?? 0;
    },
  };
}
