import "server-only";
import { createPool, loadConfig, type Config } from "@ocop/infra";

interface WebApp {
  config: Config;
  pool: ReturnType<typeof createPool>;
}

// Built lazily so `next build` never needs runtime configuration; cached on globalThis because
// Next may evaluate server modules more than once in dev.
const holder = globalThis as unknown as { ocopWebApp?: WebApp };

export function app(): WebApp {
  if (!holder.ocopWebApp) {
    const config = loadConfig();
    holder.ocopWebApp = { config, pool: createPool(config.DATABASE_URL) };
  }
  return holder.ocopWebApp;
}
