import "server-only";
import { randomUUID } from "node:crypto";
import type { RequestContext } from "@ocop/core";
import { headers } from "next/headers";

/** Request id and client address for audit rows; Caddy is the only hop that sets X-Forwarded-For. */
export async function requestContext(): Promise<RequestContext> {
  const h = await headers();
  return {
    requestId: h.get("x-request-id") ?? randomUUID(),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  };
}
