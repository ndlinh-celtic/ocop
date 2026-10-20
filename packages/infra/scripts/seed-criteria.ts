/**
 * Usage: pnpm --filter @ocop/infra seed:criteria [path/to/file.json]
 * Imports a Phiên bản tiêu chí as a draft (defaults to QĐ 26/2026, docs/tieu-chi). Quản trị reviews and
 * publishes it in the app; check the "Cần rà soát" sheet of the xlsx before publishing.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "@ocop/core";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { createPool } from "../src/db/pool";
import { seedCriteria } from "../src/seed/criteria";

const file = process.argv[2] ?? path.resolve(import.meta.dirname, "../../../docs/tieu-chi/ocop_tieu_chi_qd26_2026.json");
const config = loadConfig();
const pool = createPool(config.DATABASE_URL, 1);
try {
  const result = await seedCriteria(pool, createApp(pool, config), await readFile(file, "utf8"), path.basename(file));
  console.log(result.created ? `Đã nhập bản nháp ${result.versionId} từ ${file}` : `Đã có phiên bản ${result.versionId} cho văn bản này, bỏ qua`);
} catch (err) {
  if (err instanceof DomainError) {
    console.error(err.message);
    process.exitCode = 1;
  } else throw err;
} finally {
  await pool.end();
}
