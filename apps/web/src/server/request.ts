import "server-only";
import { randomUUID } from "node:crypto";
import { anonymousActor, type AnonymousActor, type RequestContext } from "@ocop/core";
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

/** The visitor before any session is known: sign-in, activation and password-reset use cases act as this. */
export async function anonymous(): Promise<AnonymousActor> {
  return anonymousActor(await requestContext());
}
