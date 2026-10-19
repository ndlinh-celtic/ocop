/** Domain events written to the outbox in the same transaction as the change (ADR 0001). */
export type DomainEventBody =
  | { type: "identity.user.created"; payload: { userId: string } }
  | { type: "identity.activation.requested"; payload: { userId: string } }
  | { type: "identity.role.granted"; payload: { assignmentId: string } };

export type EventType = DomainEventBody["type"];

export type DomainEvent = DomainEventBody & { id: string; occurredAt: Date };

export interface Outbox {
  add(event: DomainEvent): Promise<void>;
  get(id: string): Promise<DomainEvent | null>;
}

/** Consumers are idempotent per event: a redelivered event is skipped. */
export interface ProcessedEvents {
  /** True the first time (event, consumer) is seen in a committed transaction. */
  markIfNew(eventId: string, consumer: string, at: Date): Promise<boolean>;
}
