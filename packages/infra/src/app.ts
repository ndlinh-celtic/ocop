import { createCore, type Clock, type Core, type IdGen, type PasswordHasher } from "@ocop/core";
import type { Pool } from "pg";
import { argon2Hasher } from "./adapters/argon2";
import { systemClock, uuidV7Gen } from "./adapters/system";
import { PgUnitOfWork } from "./db/uow";

export interface AppOverrides {
  clock?: Clock;
  ids?: IdGen;
  hasher?: PasswordHasher;
}

/** Composition root: the real adapters behind the core's ports. */
export function createApp(pool: Pool, overrides: AppOverrides = {}): Core {
  return createCore({
    uow: new PgUnitOfWork(pool),
    clock: overrides.clock ?? systemClock,
    ids: overrides.ids ?? uuidV7Gen,
    hasher: overrides.hasher ?? argon2Hasher,
  });
}
