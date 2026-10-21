import type { RequestContext } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import type { RateLimit } from "./rate-limit";

/**
 * Counts this attempt against `limit` in its own committed transaction, before the guarded work runs, so
 * attempts that fail later (a duplicate, a bad form) still count. Refuses once the window is full.
 */
export async function consumeRateLimit(deps: CoreDeps, bucket: string, ctx: RequestContext, limit: RateLimit) {
  const subject = deps.secretBox.fingerprint(`rate:${ctx.ip ?? "unknown"}`);
  await deps.uow.run(async (tx) => {
    const now = deps.clock.now();
    const used = await tx.rateLimits.countSince(bucket, subject, new Date(now.getTime() - limit.windowMs));
    if (used >= limit.max) throw new DomainError("rate_limited", "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.");
    await tx.rateLimits.record(bucket, subject, now);
  });
}
