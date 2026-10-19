import type { Tx, UnitOfWork } from "@ocop/core";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool, PoolClient } from "pg";
import { buildRepos } from "../repos";

/** One pg connection per use case, wrapped in BEGIN/COMMIT; every repository shares it. */
export class PgUnitOfWork implements UnitOfWork {
  constructor(private readonly pool: Pool) {}

  async run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(buildRepos(drizzle(client), client));
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}
