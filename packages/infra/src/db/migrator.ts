import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";

/**
 * Applies the reviewed SQL files in `migrations/` in name order, each in its own transaction.
 * An applied file whose content changed since is an error: fix forward with a new file.
 */
export async function migrate(pool: Pool, dir: string): Promise<string[]> {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migration (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    // One migrator at a time, even if two `migrate` containers start together.
    await client.query("SELECT pg_advisory_lock(hashtext('ocop.schema_migration'))");
    const applied = new Map<string, string>(
      (await client.query<{ name: string; checksum: string }>("SELECT name, checksum FROM public.schema_migration")).rows.map((r) => [r.name, r.checksum]),
    );
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    const ran: string[] = [];
    for (const file of files) {
      const sql = await readFile(path.join(dir, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previous = applied.get(file);
      if (previous !== undefined) {
        if (previous !== checksum) throw new Error(`Migration ${file} was modified after it was applied`);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO public.schema_migration (name, checksum) VALUES ($1, $2)", [file, checksum]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`, { cause: err });
      }
      ran.push(file);
    }
    return ran;
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('ocop.schema_migration'))").catch(() => {});
    client.release();
  }
}

export const migrationsDir = path.resolve(import.meta.dirname, "../../migrations");
