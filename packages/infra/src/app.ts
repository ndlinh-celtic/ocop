import { createCore, type Clock, type Core, type CoreSettings, type IdGen, type Mailer, type PasswordHasher } from "@ocop/core";
import type { Pool } from "pg";
import { argon2Hasher } from "./adapters/argon2";
import { aesGcmSecretBox } from "./adapters/secret-box";
import { systemClock, uuidV7Gen } from "./adapters/system";
import { otplibTotp } from "./adapters/totp";
import type { Config } from "./config";
import { PgUnitOfWork } from "./db/uow";
import { renderingMailer, smtpTransport } from "./mail/mailer";

export interface AppOverrides {
  clock?: Clock;
  ids?: IdGen;
  hasher?: PasswordHasher;
  mailer?: Mailer;
}

export type AppConfig = Pick<Config, "TOTP_REQUIRED" | "TOTP_ENCRYPTION_KEY" | "APP_BASE_URL" | "SMTP_URL" | "MAIL_FROM">;

/** Composition root: the real adapters behind the core's ports. */
export function createApp(pool: Pool, config: AppConfig, overrides: AppOverrides = {}): Core {
  if (!config.TOTP_ENCRYPTION_KEY) throw new Error("TOTP_ENCRYPTION_KEY is required");
  const settings: CoreSettings = { totpRequired: config.TOTP_REQUIRED, appBaseUrl: config.APP_BASE_URL };
  const mailer =
    overrides.mailer ??
    (config.SMTP_URL
      ? renderingMailer(smtpTransport(config.SMTP_URL), config.MAIL_FROM)
      : {
          send: async () => {
            throw new Error("SMTP_URL is not configured");
          },
        });
  return createCore({
    uow: new PgUnitOfWork(pool),
    clock: overrides.clock ?? systemClock,
    ids: overrides.ids ?? uuidV7Gen,
    hasher: overrides.hasher ?? argon2Hasher,
    totp: otplibTotp,
    secretBox: aesGcmSecretBox(config.TOTP_ENCRYPTION_KEY),
    mailer,
    settings,
  });
}
