import { randomUUID } from "node:crypto";
import {
  anonymousActor,
  CONSUMER_NAMES,
  systemActor,
  type Clock,
  type Core,
  type DocumentRenderer,
  type FileStore,
  PdfConversionError,
  type PdfConverter,
  type RequestContext,
  type RoundActivity,
  type UserActor,
} from "@ocop/core";
import { generate } from "otplib";
import { createApp } from "../../src/app";
import type { ScanResult, VirusScanner } from "../../src/files/clamd";
import { createS3FileStore } from "../../src/files/s3";
import { createBoss, type PgBoss } from "../../src/jobs/boss";
import { relayOutbox, type EventJob } from "../../src/jobs/relay";
import { renderingMailer, type MailTransport, type OutgoingEmail } from "../../src/mail/mailer";
import type { TestDatabase } from "./database";
import { s3TestSettings } from "./s3";

/**
 * Captures rendered emails instead of sending them; can be told to fail the next N deliveries, optionally
 * after letting some through first.
 */
export class Mailbox implements MailTransport {
  private sent: OutgoingEmail[] = [];
  private failures = 0;
  private passes = 0;
  async deliver(email: OutgoingEmail) {
    if (this.failures > 0 && this.passes > 0) {
      this.passes--;
    } else if (this.failures > 0) {
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
  failNext(n: number, opts: { after?: number } = {}) {
    this.failures = n;
    this.passes = opts.after ?? 0;
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

/** The smallest valid PDF: one empty A4 page, cross-reference offsets exact. */
export const MINIMAL_PDF = (() => {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>"];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
})();

/**
 * Stands in for Gotenberg (#81): returns MINIMAL_PDF, keeps every DOCX it was given (`calls`), and can be told
 * to fail the next N conversions with the PdfConversionError the real adapter throws.
 */
export class FakePdfConverter implements PdfConverter {
  readonly calls: Uint8Array[] = [];
  private failures = 0;
  failNext(n: number) {
    this.failures = n;
  }
  get count() {
    return this.calls.length;
  }
  async toPdf(docx: Uint8Array): Promise<Uint8Array> {
    this.calls.push(docx);
    if (this.failures > 0) {
      this.failures--;
      throw new PdfConversionError("Gotenberg unreachable (simulated)");
    }
    return new Uint8Array(MINIMAL_PDF);
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
  /** The PdfConverter the app uses: the fake unless `opts.pdf` replaced it. */
  pdf: FakePdfConverter;
  /** Reads an object from the audit anchor bucket. */
  readAnchor(key: string): Promise<string>;
  /**
   * Runs the outbox relay and every consumer queue until nothing is left, like the worker would.
   * `includeRetries` also releases jobs waiting out their retry delay.
   */
  drainJobs(opts?: { includeRetries?: boolean }): Promise<void>;
  stop(): Promise<void>;
  /** Signs in through every step; pass the TOTP secret for a Người dùng who has TOTP. */
  signInAs(email: string, password: string, totpSecret?: string): Promise<UserActor>;
  signInWithToken(email: string, password: string, totpSecret?: string): Promise<{ actor: UserActor; token: string }>;
}

export function createTestApp(
  db: TestDatabase,
  opts: {
    clock?: FakeClock;
    totpRequired?: boolean;
    roundActivity?: RoundActivity;
    documents?: DocumentRenderer;
    /** Wraps the evidence bucket's FileStore, e.g. to make one call fail. */
    files?: (real: FileStore) => FileStore;
    pdf?: FakePdfConverter;
  } = {},
): TestApp {
  const clock = opts.clock ?? new FakeClock();
  const mailbox = new Mailbox();
  const scanner = new FakeScanner();
  const pdf = opts.pdf ?? new FakePdfConverter();
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
      files: (opts.files ?? ((real) => real))(createS3FileStore(s3TestSettings(), "ocop-evidence-test")),
      anchorStore,
      scanner,
      roundActivity: opts.roundActivity,
      documents: opts.documents,
      pdf,
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
    pdf,
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
