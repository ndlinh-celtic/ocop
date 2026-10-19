/** Ports the core needs from the outside world. Adapters live in @ocop/infra. */

export interface Clock {
  now(): Date;
}

/** Generates UUIDv7 primary keys (ADR 0004). */
export interface IdGen {
  next(): string;
}
