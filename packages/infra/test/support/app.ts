import { randomUUID } from "node:crypto";
import { anonymousActor, CONSUMER_NAMES, systemActor, type Clock, type Core, type RequestContext, type UserActor } from "@ocop/core";
import { generate } from "otplib";
import { createApp } from "../../src/app";
import type { ScanResult, VirusScanner } from "../../src/files/clamd";
import { createS3FileStore } from "../../src/files/s3";
import { createBoss, type PgBoss } from "../../src/jobs/boss";
import { relayOutbox, type EventJob } from "../../src/jobs/relay";
import { renderingMailer, type MailTransport, type OutgoingEmail } from "../../src/mail/mailer";
import type { TestDatabase } from "./database";
import { s3TestSettings } from "./s3";

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

/** The standard antivirus test file: harmless, but every scanner reports it. */
export const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

/** Stands in for clamd at the use-case seam: flags EICAR; can be told to be unreachable. */
export class FakeScanner implements VirusScanner {
  private failures = 0;
  failNext(n: number) {
    this.failures = n;
  }
  async scan(stream: AsyncIterable<Uint8Array>): Promise<ScanResult> {
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(Buffer.from(c));
    if (this.failures > 0) {
      this.failures--;
      throw new Error("clamd unreachable (simulated)");
    }
    return Buffer.concat(chunks).toString("latin1").includes(EICAR) ? { clean: false, signature: "Eicar-Test-Signature" } : { clean: true };
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

/** A visitor with no session, as the sign-in, activation and password-reset use cases see them. */
export const anonymous = (over: Partial<RequestContext> = {}) => anonymousActor(requestContext(over));

/** The code an authenticator app would show for `secret` at `at`. */
export const totpCode = (secret: string, at: Date) => generate({ secret, epoch: Math.floor(at.getTime() / 1000) });

export const TEST_TOTP_KEY = Buffer.alloc(32, 7).toString("base64");

export interface TestApp {
  app: Core;
  clock: FakeClock;
  mailbox: Mailbox;
  scanner: FakeScanner;
  /** Reads an object from the audit anchor bucket. */
  readAnchor(key: string): Promise<string>;
  /**
   * Runs the outbox relay and every consumer queue until nothing is left, like the worker would.
   * `includeRetries` also releases jobs waiting out their retry delay.
   */
  drainJobs(opts?: { includeRetries?: boolean }): Promise<void>;
  stop(): Promise<void>;
  /** Signs in through every step; pass the TOTP secret for accounts that have TOTP. */
  signInAs(email: string, password: string, totpSecret?: string): Promise<UserActor>;
  signInWithToken(email: string, password: string, totpSecret?: string): Promise<{ actor: UserActor; token: string }>;
}

export function createTestApp(db: TestDatabase, opts: { clock?: FakeClock; totpRequired?: boolean } = {}): TestApp {
  const clock = opts.clock ?? new FakeClock();
  const mailbox = new Mailbox();
  const scanner = new FakeScanner();
  const anchorStore = createS3FileStore(s3TestSettings(), "ocop-audit-anchor-test");
  const app = createApp(
    db.app,
    {
      TOTP_REQUIRED: opts.totpRequired ?? true,
      TOTP_ENCRYPTION_KEY: TEST_TOTP_KEY,
      APP_BASE_URL: "https://ocop.test",
      SMTP_URL: undefined,
      MAIL_FROM: "OCOP <no-reply@ocop.test>",
    },
    {
      clock,
      mailer: renderingMailer(mailbox, "OCOP <no-reply@ocop.test>"),
      files: createS3FileStore(s3TestSettings(), "ocop-evidence-test"),
      anchorStore,
      scanner,
    },
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
    scanner,
    async readAnchor(key) {
      const chunks: Buffer[] = [];
      for await (const c of await anchorStore.read(key)) chunks.push(Buffer.from(c));
      return Buffer.concat(chunks).toString("utf8");
    },
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
              await app.platform.handleEvent(systemActor(queue), { consumer: queue, eventId: job.data.eventId });
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
      return (await this.signInWithToken(email, password, totpSecret)).actor;
    },
    async signInWithToken(email, password, totpSecret) {
      const result = await app.identity.signIn(anonymous(), { email, password });
      if (!result.ok) throw new Error(`sign-in failed for ${email}: ${result.reason}`);
      if (result.stage === "totp_pending") {
        if (!totpSecret) throw new Error(`${email} has TOTP; pass its secret`);
        const step = await app.identity.verifySignInTotp(anonymous(), { sessionToken: result.sessionToken, code: await totpCode(totpSecret, clock.now()) });
        if (!step.ok) throw new Error(`TOTP step failed for ${email}: ${step.reason}`);
      } else if (result.stage === "totp_enrollment") {
        throw new Error(`${email} must enrol TOTP first`);
      }
      const actor = await app.identity.authenticate(anonymous(), { sessionToken: result.sessionToken });
      if (!actor) throw new Error("fresh session did not authenticate");
      return { actor, token: result.sessionToken };
    },
  };
}
