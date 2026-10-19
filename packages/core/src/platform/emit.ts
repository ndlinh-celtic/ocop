import type { CoreDeps } from "../shared/deps";
import type { Tx } from "../shared/uow";
import type { DomainEventBody } from "./events";

/** Adds an event to the outbox of the current transaction. */
export async function emit(deps: CoreDeps, tx: Tx, body: DomainEventBody): Promise<string> {
  const id = deps.ids.next();
  await tx.outbox.add({ ...body, id, occurredAt: deps.clock.now() });
  return id;
}
