import { createCore, DEFAULT_SETTINGS, type Clock, type Core, type CoreSettings, type IdGen, type Mailer, type PasswordHasher } from "@ocop/core";
import type { Pool } from "pg";
import { argon2Hasher } from "./adapters/argon2";
import { aesGcmSecretBox } from "./adapters/secret-box";
import { systemClock, uuidV7Gen } from "./adapters/system";
import { otplibTotp } from "./adapters/totp";
import type { Config } from "./config";
import { PgUnitOfWork } from "./db/uow";
import { clamdScanner, type VirusScanner } from "./files/clamd";
import { createFileInspector } from "./files/inspector";
import { createS3FileStore } from "./files/s3";
import type { FileStore } from "@ocop/core";
import { renderingMailer, smtpTransport } from "./mail/mailer";

export interface AppOverrides {
  clock?: Clock;
  ids?: IdGen;
  hasher?: PasswordHasher;
  mailer?: Mailer;
  files?: FileStore;
  scanner?: VirusScanner;
}

export type AppConfig = Pick<Config, "TOTP_REQUIRED" | "TOTP_ENCRYPTION_KEY" | "APP_BASE_URL" | "SMTP_URL" | "MAIL_FROM"> &
  Partial<
    Pick<
      Config,
      | "S3_ENDPOINT"
      | "S3_PUBLIC_ENDPOINT"
      | "S3_REGION"
      | "S3_ACCESS_KEY_ID"
      | "S3_SECRET_ACCESS_KEY"
      | "S3_FORCE_PATH_STYLE"
      | "S3_BUCKET_EVIDENCE"
      | "FILE_MAX_MB"
      | "CLAMD_HOST"
      | "CLAMD_PORT"
    >
  > &
  Partial<
    Pick<
      Config,
      | "LOCKOUT_MAX_FAILURES"
      | "LOCKOUT_WINDOW_MINUTES"
      | "LOCKOUT_MINUTES"
      | "SESSION_IDLE_STRICT_MINUTES"
      | "SESSION_IDLE_RELAXED_MINUTES"
      | "SESSION_MAX_HOURS"
      | "PASSWORD_RESET_MINUTES"
    >
  >;

const MIN = 60_000;

export function settingsFrom(config: AppConfig): CoreSettings {
  const d = DEFAULT_SETTINGS;
  return {
    totpRequired: config.TOTP_REQUIRED,
    appBaseUrl: config.APP_BASE_URL,
    lockout: {
      maxFailures: config.LOCKOUT_MAX_FAILURES ?? d.lockout.maxFailures,
      windowMs: config.LOCKOUT_WINDOW_MINUTES ? config.LOCKOUT_WINDOW_MINUTES * MIN : d.lockout.windowMs,
      lockMs: config.LOCKOUT_MINUTES ? config.LOCKOUT_MINUTES * MIN : d.lockout.lockMs,
    },
    session: {
      idleStrictMs: config.SESSION_IDLE_STRICT_MINUTES ? config.SESSION_IDLE_STRICT_MINUTES * MIN : d.session.idleStrictMs,
      idleRelaxedMs: config.SESSION_IDLE_RELAXED_MINUTES ? config.SESSION_IDLE_RELAXED_MINUTES * MIN : d.session.idleRelaxedMs,
      maxLifetimeMs: config.SESSION_MAX_HOURS ? config.SESSION_MAX_HOURS * 60 * MIN : d.session.maxLifetimeMs,
    },
    passwordResetTtlMs: config.PASSWORD_RESET_MINUTES ? config.PASSWORD_RESET_MINUTES * MIN : d.passwordResetTtlMs,
    files: { ...d.files, maxBytes: config.FILE_MAX_MB ? config.FILE_MAX_MB * 1024 * 1024 : d.files.maxBytes },
  };
}

export function s3SettingsFrom(config: AppConfig) {
  if (!config.S3_ENDPOINT || !config.S3_ACCESS_KEY_ID || !config.S3_SECRET_ACCESS_KEY) return null;
  return {
    endpoint: config.S3_ENDPOINT,
    publicEndpoint: config.S3_PUBLIC_ENDPOINT,
    region: config.S3_REGION ?? "us-east-1",
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    forcePathStyle: config.S3_FORCE_PATH_STYLE ?? true,
  };
}

/** Fails at use, not at start-up, so processes that never touch files run without S3 configured. */
const unconfigured = new Proxy({} as FileStore, {
  get: () => async () => {
    throw new Error("S3 is not configured (S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)");
  },
});

/** Composition root: the real adapters behind the core's ports. */
export function createApp(pool: Pool, config: AppConfig, overrides: AppOverrides = {}): Core {
  if (!config.TOTP_ENCRYPTION_KEY) throw new Error("TOTP_ENCRYPTION_KEY is required");
  const settings = settingsFrom(config);
  const mailer =
    overrides.mailer ??
    (config.SMTP_URL
      ? renderingMailer(smtpTransport(config.SMTP_URL), config.MAIL_FROM)
      : {
          send: async () => {
            throw new Error("SMTP_URL is not configured");
          },
        });
  const s3 = s3SettingsFrom(config);
  const files = overrides.files ?? (s3 ? createS3FileStore(s3, config.S3_BUCKET_EVIDENCE ?? "ocop-evidence") : unconfigured);
  return createCore({
    uow: new PgUnitOfWork(pool),
    clock: overrides.clock ?? systemClock,
    ids: overrides.ids ?? uuidV7Gen,
    hasher: overrides.hasher ?? argon2Hasher,
    totp: otplibTotp,
    secretBox: aesGcmSecretBox(config.TOTP_ENCRYPTION_KEY),
    mailer,
    files,
    inspector: createFileInspector(files, overrides.scanner ?? clamdScanner({ host: config.CLAMD_HOST ?? "clamd", port: config.CLAMD_PORT ?? 3310 })),
    settings,
  });
}
