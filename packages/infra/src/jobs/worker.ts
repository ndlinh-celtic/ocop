import { CONSUMER_NAMES, systemActor, type Core } from "@ocop/core";
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
      if (job) await core.platform.handleEvent(systemActor(consumer, { requestId: `job:${job.id}` }), { consumer, eventId: job.data.eventId });
    });
  }
  // ADR 0002: seal every minute, verify nightly, anchor the day that ended just after midnight (Vietnam time).
  const tz = "Asia/Ho_Chi_Minh";
  await boss.schedule("audit.seal", "* * * * *", null, { tz });
  await boss.schedule("audit.verify", "0 2 * * *", null, { tz });
  await boss.schedule("audit.anchor", "5 0 * * *", null, { tz });
  await boss.work("audit.seal", async () => {
    // Drain the backlog in batches; each call seals at most one batch.
    while ((await core.audit.seal(systemActor("audit.seal"))).sealed > 0);
  });
  await boss.work("audit.verify", async () => {
    await core.audit.verify(systemActor("audit.verify"));
  });
  await boss.work("audit.anchor", async () => {
    await core.audit.anchor(systemActor("audit.anchor"));
  });

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
