import type { AuditEntry } from "./audit";

/** One link of the chain: the audit row it covers and the hash that includes everything before it. */
export interface AuditSeal {
  seq: number;
  auditId: string;
  auditOccurredAt: Date;
  hash: string;
  sealedAt: Date;
}

export interface AuditChainRepo {
  /** Serialises sealers; false when another sealer holds the lock. */
  tryLock(): Promise<boolean>;
  lastSeal(): Promise<AuditSeal | null>;
  /** Audit rows with no seal, stamped before `cutoff`, oldest first. */
  unsealed(cutoff: Date, limit: number): Promise<AuditEntry[]>;
  insertSeals(seals: AuditSeal[]): Promise<void>;
  insertCheckpoint(c: { id: string; lastSeq: number; lastHash: string; sealedCount: number; createdAt: Date }): Promise<void>;
  /** Seals from `afterSeq` on, joined with their audit row (null when the row is gone). */
  sealsWithRows(afterSeq: number, limit: number): Promise<{ seal: AuditSeal; row: AuditEntry | null }[]>;
}
