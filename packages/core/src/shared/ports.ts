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

export type TotpCheck = { valid: true; step: number } | { valid: false };

/** RFC 6238, 30-second steps, 6 digits: what every authenticator app speaks. */
export interface TotpService {
  generateSecret(): string;
  keyUri(label: string, secret: string): string;
  /** Rejects codes from steps at or before `afterStep`, so a code cannot be replayed. */
  verify(secret: string, code: string, at: Date, afterStep: number | null): Promise<TotpCheck>;
}

/** Authenticated encryption for secrets stored at rest (TOTP secrets). */
export interface SecretBox {
  seal(plain: string): string;
  open(sealed: string): string;
}
