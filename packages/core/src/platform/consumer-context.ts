import type { CoreDeps } from "../shared/deps";
import type { Tx } from "../shared/uow";
import type { DomainEvent } from "./events";

export interface ConsumerContext {
  deps: CoreDeps;
  tx: Tx;
  event: DomainEvent;
  consumer: string;
}
