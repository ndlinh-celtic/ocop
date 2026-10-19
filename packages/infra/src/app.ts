import { createCore, type Clock, type Core, type CoreSettings, type IdGen, type PasswordHasher } from "@ocop/core";
import type { Pool } from "pg";
import { argon2Hasher } from "./adapters/argon2";
import { aesGcmSecretBox } from "./adapters/secret-box";
import { systemClock, uuidV7Gen } from "./adapters/system";
import { otplibTotp } from "./adapters/totp";
import type { Config } from "./config";
import { PgUnitOfWork } from "./db/uow";

export interface AppOverrides {
  clock?: Clock;
  ids?: IdGen;
  hasher?: PasswordHasher;
}

export type AppConfig = Pick<Config, "TOTP_REQUIRED" | "TOTP_ENCRYPTION_KEY">;

/** Composition root: the real adapters behind the core's ports. */
export function createApp(pool: Pool, config: AppConfig, overrides: AppOverrides = {}): Core {
  if (!config.TOTP_ENCRYPTION_KEY) throw new Error("TOTP_ENCRYPTION_KEY is required");
  const settings: CoreSettings = { totpRequired: config.TOTP_REQUIRED };
  return createCore({
    uow: new PgUnitOfWork(pool),
    clock: overrides.clock ?? systemClock,
    ids: overrides.ids ?? uuidV7Gen,
    hasher: overrides.hasher ?? argon2Hasher,
    totp: otplibTotp,
    secretBox: aesGcmSecretBox(config.TOTP_ENCRYPTION_KEY),
    settings,
  });
}
