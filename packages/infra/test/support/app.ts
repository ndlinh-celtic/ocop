import { randomUUID } from "node:crypto";
import type { Clock, Core, RequestContext, UserActor } from "@ocop/core";
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

export interface TestApp {
  app: Core;
  clock: FakeClock;
  signInAs(email: string, password: string): Promise<UserActor>;
}

export function createTestApp(db: TestDatabase, opts: { clock?: FakeClock } = {}): TestApp {
  const clock = opts.clock ?? new FakeClock();
  const app = createApp(db.app, { clock });
  return {
    app,
    clock,
    async signInAs(email, password) {
      const result = await app.identity.signIn({ email, password }, requestContext());
      if (!result.ok) throw new Error(`sign-in failed for ${email}: ${result.reason}`);
      const actor = await app.identity.authenticate(result.sessionToken, requestContext());
      if (!actor) throw new Error("fresh session did not authenticate");
      return actor;
    },
  };
}
