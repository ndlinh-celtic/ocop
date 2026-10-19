/** Ports the core needs from the outside world. Adapters live in @ocop/infra. */

export interface Clock {
  now(): Date;
}

/** Generates UUIDv7 primary keys (ADR 0004). */
export interface IdGen {
  next(): string;
}

/** argon2id in production (ADR 0005). */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}
