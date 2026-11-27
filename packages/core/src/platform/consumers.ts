import type { SystemActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import type { Consumer } from "./consumer-context";

/**
 * Runs one consumer for one event, at most once per committed transaction. The consumers are the ones every module
 * declares in its `module.ts`, merged by the registry (each one is its own job queue).
 */
export function handleEvent<N extends string>(deps: CoreDeps, consumers: Record<N, Consumer>) {
  return (_system: SystemActor, input: { consumer: N; eventId: string }) =>
    deps.uow.run(async (tx) => {
      const { consumer, eventId } = input;
      const event = await tx.outbox.get(eventId);
      if (!event) throw new DomainError("event_not_found", `Event ${eventId} not in outbox`);
      if (!(await tx.processedEvents.markIfNew(eventId, consumer, deps.clock.now()))) return "skipped" as const;
      await consumers[consumer].handle({ deps, tx, event, consumer });
      return "handled" as const;
    });
}
