import { randomUUID } from "node:crypto";
import { CONSUMER_NAMES, type Clock, type Core, type RequestContext, type UserActor } from "@ocop/core";
import { generate } from "otplib";
import { createApp } from "../../src/app";
import { createBoss, type PgBoss } from "../../src/jobs/boss";
import { relayOutbox, type EventJob } from "../../src/jobs/relay";
import { renderingMailer, type MailTransport, type OutgoingEmail } from "../../src/mail/mailer";
import type { TestDatabase } from "./database";

/** Captures rendered emails instead of sending them; can be told to fail the next N deliveries. */
export class Mailbox implements MailTransport {
  private sent: OutgoingEmail[] = [];
  private failures = 0;
  async deliver(email: OutgoingEmail) {
    if (this.failures > 0) {
      this.failures--;
      throw new Error("SMTP unavailable (simulated)");
    }
    this.sent.push(email);
  }
  all() {
    return [...this.sent];
  }
  to(address: string) {
    return this.sent.filter((e) => e.to.toLowerCase() === address.toLowerCase());
  }
  failNext(n: number) {
    this.failures = n;
  }
}

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
  mailbox: Mailbox;
  /**
   * Runs the outbox relay and every consumer queue until nothing is left, like the worker would.
   * `includeRetries` also releases jobs waiting out their retry delay.
   */
  drainJobs(opts?: { includeRetries?: boolean }): Promise<void>;
  stop(): Promise<void>;
  /** Signs in through every step; pass the TOTP secret for accounts that have TOTP. */
  signInAs(email: string, password: string, totpSecret?: string): Promise<UserActor>;
}

export function createTestApp(db: TestDatabase, opts: { clock?: FakeClock; totpRequired?: boolean } = {}): TestApp {
  const clock = opts.clock ?? new FakeClock();
  const mailbox = new Mailbox();
  const app = createApp(
    db.app,
    {
      TOTP_REQUIRED: opts.totpRequired ?? true,
      TOTP_ENCRYPTION_KEY: TEST_TOTP_KEY,
      APP_BASE_URL: "https://ocop.test",
      SMTP_URL: undefined,
      MAIL_FROM: "OCOP <no-reply@ocop.test>",
    },
    { clock, mailer: renderingMailer(mailbox, "OCOP <no-reply@ocop.test>") },
  );
  let boss: PgBoss | undefined;
  const ensureBoss = async () => {
    if (!boss) {
      boss = createBoss(db.url("app"), { supervise: false, schedule: false });
      await boss.start();
    }
    return boss;
  };
  return {
    app,
    clock,
    mailbox,
    async drainJobs({ includeRetries = false } = {}) {
      const b = await ensureBoss();
      if (includeRetries) await db.admin.query("UPDATE pgboss.job SET start_after = now() WHERE state = 'retry'");
      for (let round = 0; round < 20; round++) {
        let work = await relayOutbox(db.app, b);
        for (const queue of CONSUMER_NAMES) {
          const jobs = await b.fetch<EventJob>(queue, { batchSize: 50 });
          work += jobs.length;
          for (const job of jobs) {
            try {
              await app.platform.handleEvent(queue, job.data.eventId);
              await b.complete(queue, job.id);
            } catch (err) {
              await b.fail(queue, job.id, { message: (err as Error).message });
            }
          }
        }
        if (work === 0) return;
      }
      throw new Error("jobs did not settle after 20 rounds");
    },
    async stop() {
      await boss?.stop({ graceful: false });
    },
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
