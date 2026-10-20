import pg from "pg";

// timestamptz values come back as Date (UTC); bigint counters as string are fine.
export function createPool(connectionString: string, max = 10): pg.Pool {
  return new pg.Pool({ connectionString, max });
}

export async function checkDatabase(pool: pg.Pool): Promise<void> {
  await pool.query("SELECT 1");
}
