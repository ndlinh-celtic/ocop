import "server-only";
import type { Core } from "@ocop/core";
import { createApp, createPool, loadConfig, type Config } from "@ocop/infra";

interface WebApp {
  config: Config;
  pool: ReturnType<typeof createPool>;
  core: Core;
}

// Built lazily so `next build` never needs runtime configuration; cached on globalThis because
// Next may evaluate server modules more than once in dev.
const holder = globalThis as unknown as { ocopWebApp?: WebApp };

export function app(): WebApp {
  if (!holder.ocopWebApp) {
    const config = loadConfig();
    const pool = createPool(config.DATABASE_URL);
    holder.ocopWebApp = { config, pool, core: createApp(pool) };
  }
  return holder.ocopWebApp;
}
