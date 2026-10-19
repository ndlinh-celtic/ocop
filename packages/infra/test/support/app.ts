import { randomUUID } from "node:crypto";
import type { Clock, Core, RequestContext, UserActor } from "@ocop/core";
import { generate } from "otplib";
import { createApp } from "../../src/app";
import type { TestDatabase } from "./database";

/** A clock tests move by hand: expiry, lockouts and sealing windows without sleeping. */
export class FakeClock implements Clock {
  constructor(private current = new Date("2026-10-19T02:00:00Z")) {}
  now() {
    return new Date(this.current);
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
  set(at: Date) {
    this.current = new Date(at);
  }
}

export const minutes = (n: number) => n * 60_000;
export const hours = (n: number) => n * 3_600_000;

export const requestContext = (over: Partial<RequestContext> = {}): RequestContext => ({
  requestId: randomUUID(),
  ip: "203.0.113.10",
  userAgent: "vitest",
  ...over,
});

/** The code an authenticator app would show for `secret` at `at`. */
export const totpCode = (secret: string, at: Date) => generate({ secret, epoch: Math.floor(at.getTime() / 1000) });

export const TEST_TOTP_KEY = Buffer.alloc(32, 7).toString("base64");

export interface TestApp {
  app: Core;
  clock: FakeClock;
  /** Signs in through every step; pass the TOTP secret for accounts that have TOTP. */
  signInAs(email: string, password: string, totpSecret?: string): Promise<UserActor>;
}

export function createTestApp(db: TestDatabase, opts: { clock?: FakeClock; totpRequired?: boolean } = {}): TestApp {
  const clock = opts.clock ?? new FakeClock();
  const app = createApp(db.app, { TOTP_REQUIRED: opts.totpRequired ?? true, TOTP_ENCRYPTION_KEY: TEST_TOTP_KEY }, { clock });
  return {
    app,
    clock,
    async signInAs(email, password, totpSecret) {
      const result = await app.identity.signIn({ email, password }, requestContext());
      if (!result.ok) throw new Error(`sign-in failed for ${email}: ${result.reason}`);
      if (result.stage === "totp_pending") {
        if (!totpSecret) throw new Error(`${email} has TOTP; pass its secret`);
        const step = await app.identity.verifySignInTotp(result.sessionToken, await totpCode(totpSecret, clock.now()), requestContext());
        if (!step.ok) throw new Error(`TOTP step failed for ${email}: ${step.reason}`);
      } else if (result.stage === "totp_enrollment") {
        throw new Error(`${email} must enrol TOTP first`);
      }
      const actor = await app.identity.authenticate(result.sessionToken, requestContext());
      if (!actor) throw new Error("fresh session did not authenticate");
      return actor;
    },
  };
}
