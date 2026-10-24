import { createHash } from "node:crypto";
import { canonical } from "../shared/canonical";
import { auditEntry, type AuditEntry } from "./audit";
import type { AuditSeal } from "./chain-repo";
import { authorize } from "../identity/policy";
import { systemActor, type Actor, type SystemActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";

export const GENESIS_HASH = createHash("sha256").update("ocop-audit-genesis").digest("hex");
/** Rows younger than this may still belong to transactions that have not committed (ADR 0002). */
export const SEAL_DELAY_MS = 30_000;
const BATCH = 5000;

export function chainHash(prevHash: string, row: AuditEntry): string {
  return createHash("sha256").update(prevHash).update("\n").update(canonical(row)).digest("hex");
}

/**
 * Worker job, every minute: seals the rows that are old enough, in the order it finds them.
 * Another sealer holding the lock makes it skip, unless `wait` is set.
 */
export function sealAuditBatch(deps: CoreDeps) {
  return (_system: SystemActor, opts: { wait?: boolean } = {}) =>
    deps.uow.run(async (tx) => {
      if (opts.wait) await tx.auditChain.lock();
      else if (!(await tx.auditChain.tryLock())) return { sealed: 0, lastSeq: 0, lastHash: GENESIS_HASH, skipped: true };
      const now = deps.clock.now();
      const last = await tx.auditChain.lastSeal();
      let seq = last?.seq ?? 0;
      let hash = last?.hash ?? GENESIS_HASH;
      const rows = await tx.auditChain.unsealed(new Date(now.getTime() - SEAL_DELAY_MS), BATCH);
      const seals: AuditSeal[] = rows.map((row) => {
        seq += 1;
        hash = chainHash(hash, row);
        return { seq, auditId: row.id, auditOccurredAt: row.occurredAt, hash, sealedAt: now };
      });
      if (seals.length) {
        await tx.auditChain.insertSeals(seals);
        await tx.auditChain.insertCheckpoint({ id: deps.ids.next(), lastSeq: seq, lastHash: hash, sealedCount: seals.length, createdAt: now });
      }
      return { sealed: seals.length, lastSeq: seq, lastHash: hash, skipped: false };
    });
}

export type ChainVerification =
  | { ok: true; checked: number; lastSeq: number }
  | { ok: false; checked: number; brokenAtSeq: number; reason: "hash_mismatch" | "row_missing" | "gap" | "checkpoint_mismatch" };

/**
 * Nightly job: recomputes the chain; a break is audited and logged for the monitoring stack.
 * With `since`, it starts from the last checkpoint written before that time instead of from genesis,
 * after checking that the checkpoint still agrees with its seal.
 */
export function verifyAuditChain(deps: CoreDeps) {
  return async (system: SystemActor, opts: { since?: Date } = {}): Promise<ChainVerification> => {
    let prev = GENESIS_HASH;
    let expectedSeq = 1;
    let checked = 0;
    let result: ChainVerification | null = null;
    const checkpoint = opts.since ? await deps.uow.run((tx) => tx.auditChain.checkpointBefore(opts.since!)) : null;
    if (checkpoint) {
      const [at] = await deps.uow.run((tx) => tx.auditChain.sealsWithRows(checkpoint.lastSeq - 1, 1));
      if (!at || at.seal.seq !== checkpoint.lastSeq || at.seal.hash !== checkpoint.lastHash) {
        result = { ok: false, checked, brokenAtSeq: checkpoint.lastSeq, reason: "checkpoint_mismatch" };
      }
      prev = checkpoint.lastHash;
      expectedSeq = checkpoint.lastSeq + 1;
    }
    while (!result) {
      const page = await deps.uow.run((tx) => tx.auditChain.sealsWithRows(expectedSeq - 1, 2000));
      if (page.length === 0) break;
      for (const { seal, row } of page) {
        checked++;
        const reason = seal.seq !== expectedSeq ? "gap" : !row ? "row_missing" : chainHash(prev, row) !== seal.hash ? "hash_mismatch" : null;
        if (reason) {
          result = { ok: false, checked, brokenAtSeq: seal.seq !== expectedSeq ? expectedSeq : seal.seq, reason };
          break;
        }
        prev = seal.hash;
        expectedSeq++;
      }
      if (result) break;
    }
    if (!result) return { ok: true, checked, lastSeq: expectedSeq - 1 };
    const broken = result;
    console.error(JSON.stringify({ level: "error", msg: "audit chain broken", ...broken }));
    await deps.uow.run((tx) =>
      tx.audit.append(auditEntry(system, deps.ids.next(), deps.clock.now(), { action: "audit.chain.broken", metadata: { ...broken } })),
    );
    return broken;
  };
}

const vnDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(d);
const DAY_MS = 24 * 3_600_000;

/**
 * Daily job, just after midnight Vietnam time: seals what is left of the day that ended, then copies
 * the last sealed hash outside the database, so a DB admin cannot rewrite the whole chain.
 * The anchor is named after that day; it may also cover the first minutes of the new one.
 */
export function anchorAuditChain(deps: CoreDeps) {
  const seal = sealAuditBatch(deps);
  return async (system: SystemActor) => {
    while ((await seal(system, { wait: true })).sealed === BATCH);
    const last = await deps.uow.run((tx) => tx.auditChain.lastSeal());
    if (!last) return null;
    const now = deps.clock.now();
    const key = `anchors/${vnDate(new Date(now.getTime() - DAY_MS))}-${last.seq}.json`;
    const body = JSON.stringify({ lastSeq: last.seq, lastHash: last.hash, sealedAt: last.sealedAt.toISOString(), anchoredAt: now.toISOString() });
    await deps.anchorStore.put(key, body, "application/json");
    await deps.uow.run((tx) =>
      tx.audit.append(auditEntry(system, deps.ids.next(), now, { action: "audit.anchored", metadata: { key, lastSeq: last.seq, lastHash: last.hash } })),
    );
    return { key, lastSeq: last.seq, lastHash: last.hash };
  };
}

/** Admin wrappers so the worker's jobs can also be triggered from the UI. */
export function verifyAuditChainAsAdmin(deps: CoreDeps) {
  const verify = verifyAuditChain(deps);
  return async (actor: Actor) => {
    authorize(actor, "audit.search");
    return verify(systemActor("audit.verify", actor.ctx));
  };
}
