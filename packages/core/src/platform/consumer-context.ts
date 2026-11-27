import type { CoreDeps } from "../shared/deps";
import type { Tx } from "../shared/uow";
import type { DomainEvent, EventType } from "./events";

export interface ConsumerContext {
  deps: CoreDeps;
  tx: Tx;
  event: DomainEvent;
  consumer: string;
}

/** One outbox consumer: its own job queue, subscribed to `events`; the relay enqueues one job per event it subscribes to. */
export interface Consumer {
  events: readonly EventType[];
  handle(c: ConsumerContext): Promise<void>;
}
