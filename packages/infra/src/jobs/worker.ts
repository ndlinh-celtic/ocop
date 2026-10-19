import { CONSUMER_NAMES, type Core } from "@ocop/core";
import type { Pool } from "pg";
import type { PgBoss } from "pg-boss";
import { QUEUES } from "./boss";
import { relayOutbox, type EventJob } from "./relay";

/** Starts the outbox relay loop and one pg-boss worker per consumer. Returns a stop function. */
export async function startWorkers(core: Core, pool: Pool, boss: PgBoss, opts: { relayIntervalMs?: number } = {}) {
  // A queue this code needs but the database lacks would stall the relay for every event: refuse to start.
  const missing = [];
  for (const queue of QUEUES) if (!(await boss.getQueue(queue))) missing.push(queue);
  if (missing.length) throw new Error(`Job queues missing: ${missing.join(", ")}. Run the migrate container first.`);

  for (const consumer of CONSUMER_NAMES) {
    await boss.work<EventJob>(consumer, async ([job]) => {
      if (job) await core.platform.handleEvent(consumer, job.data.eventId);
    });
  }
  let running = true;
  let timer: NodeJS.Timeout | undefined;
  const loop = async () => {
    try {
      while (running && (await relayOutbox(pool, boss)) > 0);
    } catch (err) {
      console.error("outbox relay failed", err);
    }
    if (running) timer = setTimeout(loop, opts.relayIntervalMs ?? 1000);
  };
  void loop();
  return () => {
    running = false;
    clearTimeout(timer);
  };
}
