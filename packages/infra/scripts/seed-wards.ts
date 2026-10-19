/** Usage: pnpm --filter @ocop/infra seed:wards [path/to/wards.csv]  (defaults to the sample list) */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../src/config";
import { createPool } from "../src/db/pool";
import { seedWards } from "../src/seed/wards";

const file = process.argv[2] ?? path.resolve(import.meta.dirname, "../seed/wards.sample.csv");
const pool = createPool(loadConfig().DATABASE_URL, 1);
try {
  console.log(`Đã nạp ${await seedWards(pool, await readFile(file, "utf8"))} xã/phường từ ${file}`);
} finally {
  await pool.end();
}
