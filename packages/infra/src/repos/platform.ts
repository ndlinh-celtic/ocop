import type { DomainEvent, EmailDeliveries, EmailDelivery, Outbox, ProcessedEvents } from "@ocop/core";
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db/types";
import { emailDelivery, outbox, processedEvent } from "../db/schema";

export function outboxRepo(db: Db): Outbox {
  return {
    async add(e) {
      await db.insert(outbox).values({ id: e.id, type: e.type, payload: e.payload, occurredAt: e.occurredAt });
    },
    async get(id) {
      const [row] = await db.select().from(outbox).where(eq(outbox.id, id));
      return row ? ({ id: row.id, type: row.type, payload: row.payload, occurredAt: row.occurredAt } as DomainEvent) : null;
    },
  };
}

export function processedEventsRepo(db: Db): ProcessedEvents {
  return {
    async markIfNew(eventId, consumer, at) {
      const rows = await db.insert(processedEvent).values({ eventId, consumer, processedAt: at }).onConflictDoNothing().returning();
      return rows.length === 1;
    },
  };
}

export function emailDeliveriesRepo(db: Db): EmailDeliveries {
  return {
    async record(d) {
      await db.insert(emailDelivery).values(d);
    },
    async list(f) {
      const rows = await db
        .select()
        .from(emailDelivery)
        .where(f.to ? sql`${emailDelivery.recipient} = ${f.to}::citext` : undefined)
        .orderBy(emailDelivery.attemptedAt, emailDelivery.id)
        .limit(f.limit ?? 100);
      return rows as EmailDelivery[];
    },
    async wasSent(eventId, consumer, recipient) {
      const rows = await db
        .select({ id: emailDelivery.id })
        .from(emailDelivery)
        .where(
          and(
            eq(emailDelivery.eventId, eventId),
            eq(emailDelivery.consumer, consumer),
            sql`${emailDelivery.recipient} = ${recipient}::citext`,
            eq(emailDelivery.status, "sent"),
          ),
        )
        .limit(1);
      return rows.length === 1;
    },
  };
}

