import { consumersFor, type EventType } from "@ocop/core";
import type { Pool } from "pg";
import type { PgBoss } from "pg-boss";

export interface EventJob {
  eventId: string;
}

/**
 * Moves pending outbox events into one pg-boss job per subscribed consumer. The jobs are inserted
 * on the same connection and transaction that marks the events dispatched, so each (event,
 * consumer) is enqueued exactly once; SKIP LOCKED lets several relays run side by side.
 */
export async function relayOutbox(pool: Pool, boss: PgBoss, limit = 100): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string; type: EventType }>(
      "SELECT id, type FROM platform.outbox WHERE dispatched_at IS NULL ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED",
      [limit],
    );
    const db = { executeSql: (text: string, values?: unknown[]) => client.query(text, values as unknown[]) };
    for (const row of rows) {
      for (const consumer of consumersFor(row.type)) {
        await boss.send(consumer, { eventId: row.id } satisfies EventJob, { db });
      }
    }
    if (rows.length) {
      await client.query("UPDATE platform.outbox SET dispatched_at = now() WHERE id = ANY($1::uuid[])", [rows.map((r) => r.id)]);
    }
    await client.query("COMMIT");
    return rows.length;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
