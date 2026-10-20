export type OneTimePurpose = "activation" | "password_reset";

/** A single-use link; only the hash of the token is stored. */
export interface OneTimeToken {
  id: string;
  userId: string;
  purpose: OneTimePurpose;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  invalidatedAt: Date | null;
}

export interface OneTimeTokenRepo {
  insert(t: OneTimeToken): Promise<void>;
  findByHash(hash: string): Promise<OneTimeToken | null>;
  markUsed(id: string, at: Date): Promise<void>;
  /** Voids every unused token of that purpose for the user, so only the newest link works. */
  invalidateOpen(userId: string, purpose: OneTimePurpose, at: Date): Promise<void>;
}

export const ACTIVATION_TTL_MS = 72 * 3_600_000;

export const isUsable = (t: OneTimeToken, at: Date) => !t.usedAt && !t.invalidatedAt && at < t.expiresAt;
