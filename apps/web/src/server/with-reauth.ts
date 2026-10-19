import "server-only";
import { DomainError } from "@ocop/core";
import { app } from "./app";
import { requireActor } from "./session";

export type ReauthNeeded = { reauth: true; method: "totp" | "password" };

/** Runs a sensitive operation; when Xác thực lại is due, tells the client which proof to ask for. */
export async function withReauth<T>(run: () => Promise<T>): Promise<{ ok: true; value: T } | ReauthNeeded> {
  try {
    return { ok: true, value: await run() };
  } catch (err) {
    if (err instanceof DomainError && err.code === "reauth_required") {
      const totp = await app().core.identity.hasTotp(await requireActor());
      return { reauth: true, method: totp ? "totp" : "password" };
    }
    throw err;
  }
}
