/**
 * Creates the first Quản trị. Run on the server, e.g.:
 *   docker compose run --rm -it worker pnpm --filter @ocop/infra admin:create
 * Reads OCOP_ADMIN_EMAIL / OCOP_ADMIN_NAME / OCOP_ADMIN_PASSWORD, prompting for any that are missing.
 */
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { DomainError } from "@ocop/core";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { createPool } from "../src/db/pool";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (env: string, question: string) => process.env[env] || (await rl.question(question));

const email = await ask("OCOP_ADMIN_EMAIL", "Email: ");
const fullName = await ask("OCOP_ADMIN_NAME", "Họ tên: ");
const password = await ask("OCOP_ADMIN_PASSWORD", "Mật khẩu (ít nhất 12 ký tự): ");
rl.close();

const config = loadConfig();
const pool = createPool(config.DATABASE_URL, 1);
try {
  const { userId } = await createApp(pool, config).identity.bootstrapFirstAdmin(
    { email, fullName, password },
    { requestId: randomUUID(), userAgent: "cli:admin:create" },
  );
  console.log(`Đã tạo Quản trị ${email} (${userId}). Đăng nhập để đăng ký TOTP.`);
} catch (err) {
  if (err instanceof DomainError) {
    console.error(err.message);
    process.exitCode = 1;
  } else throw err;
} finally {
  await pool.end();
}
