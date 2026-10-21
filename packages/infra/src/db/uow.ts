import type { Tx, UnitOfWork } from "@ocop/core";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool, PoolClient } from "pg";
import { buildRepos } from "../repos";

/**
 * One pg connection per use case, wrapped in BEGIN/COMMIT; every repository shares it. After a rollback
 * it runs the undos registered with `tx.onRollback`, so storage written for the transaction does not
 * outlive it.
 */
export class PgUnitOfWork implements UnitOfWork {
  constructor(private readonly pool: Pool) {}

  async run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    const undos: (() => Promise<void>)[] = [];
    try {
      await client.query("BEGIN");
      const result = await fn({ ...buildRepos(drizzle(client)), onRollback: (undo) => void undos.push(undo) });
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      // Best effort: the use case's own error is what the caller must see, and an undo that fails only
      // leaves an object nothing references.
      await Promise.allSettled(undos.map((undo) => undo()));
      throw err;
    } finally {
      client.release();
    }
  }
}
