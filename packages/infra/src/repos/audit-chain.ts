import type { AuditChainRepo, AuditEntry, AuditSeal } from "@ocop/core";
import { sql } from "drizzle-orm";
import type { Db } from "../db/types";

type Row = Record<string, unknown>;

const toEntry = (r: Row): AuditEntry => ({
  id: r.id as string,
  occurredAt: new Date(r.occurred_at as string | Date),
  actorUserId: (r.actor_user_id as string | null) ?? null,
  actorRole: (r.actor_role as string | null) ?? null,
  action: r.action as string,
  targetType: (r.target_type as string | null) ?? null,
  targetId: (r.target_id as string | null) ?? null,
  before: r.before ?? null,
  after: r.after ?? null,
  metadata: (r.metadata as Record<string, unknown>) ?? {},
  requestId: (r.request_id as string | null) ?? null,
  ip: (r.ip as string | null) ?? null,
});

const toSeal = (r: Row): AuditSeal => ({
  seq: Number(r.seq),
  auditId: r.audit_id as string,
  auditOccurredAt: new Date(r.audit_occurred_at as string | Date),
  hash: r.hash as string,
  sealedAt: new Date(r.sealed_at as string | Date),
});

export function auditChainRepo(db: Db): AuditChainRepo {
  return {
    async tryLock() {
      const { rows } = await db.execute<{ locked: boolean }>(sql`SELECT pg_try_advisory_xact_lock(hashtext('ocop.audit.seal')) AS locked`);
      return rows[0]?.locked === true;
    },
    async lastSeal() {
      const { rows } = await db.execute<Row>(sql`SELECT * FROM platform.audit_seal ORDER BY seq DESC LIMIT 1`);
      return rows[0] ? toSeal(rows[0]) : null;
    },
    async unsealed(cutoff, limit) {
      const { rows } = await db.execute<Row>(sql`
        SELECT a.* FROM platform.audit_log a
        WHERE a.occurred_at < ${cutoff}
          AND NOT EXISTS (SELECT 1 FROM platform.audit_seal s WHERE s.audit_id = a.id)
        ORDER BY a.occurred_at, a.id
        LIMIT ${limit}`);
      return rows.map(toEntry);
    },
    async insertSeals(seals) {
      for (const s of seals) {
        await db.execute(sql`
          INSERT INTO platform.audit_seal (seq, audit_id, audit_occurred_at, hash, sealed_at)
          VALUES (${s.seq}, ${s.auditId}, ${s.auditOccurredAt}, ${s.hash}, ${s.sealedAt})`);
      }
    },
    async insertCheckpoint(c) {
      await db.execute(sql`
        INSERT INTO platform.audit_checkpoint (id, last_seq, last_hash, sealed_count, created_at)
        VALUES (${c.id}, ${c.lastSeq}, ${c.lastHash}, ${c.sealedCount}, ${c.createdAt})`);
    },
    async sealsWithRows(afterSeq, limit) {
      // Joining on occurred_at too lets Postgres look in one monthly partition only.
      const { rows } = await db.execute<Row>(sql`
        SELECT s.seq, s.audit_id, s.audit_occurred_at, s.hash, s.sealed_at, to_jsonb(a) AS row
        FROM platform.audit_seal s
        LEFT JOIN platform.audit_log a ON a.id = s.audit_id AND a.occurred_at = s.audit_occurred_at
        WHERE s.seq > ${afterSeq}
        ORDER BY s.seq
        LIMIT ${limit}`);
      return rows.map((r) => ({ seal: toSeal(r), row: r.row ? toEntry(r.row as Row) : null }));
    },
  };
}
