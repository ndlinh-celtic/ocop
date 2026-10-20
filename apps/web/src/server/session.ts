import "server-only";
import type { UserActor } from "@ocop/core";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { app } from "./app";
import { requestContext } from "./request";

export const SESSION_COOKIE = "ocop_session";

export async function setSessionCookie(token: string) {
  // Always Secure: browsers still accept it on http://localhost, and anywhere else must be https.
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in actor for this request, or null. Expiry and revocation are decided by the core. */
export async function currentActor(): Promise<UserActor | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return app().core.identity.authenticate(token, await requestContext());
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function requireActor(): Promise<UserActor> {
  const actor = await currentActor();
  if (!actor) redirect("/dang-nhap");
  return actor;
}
