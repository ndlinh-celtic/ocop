import { createHash } from "node:crypto";
import { auditEntry, type AuditEntry } from "./audit";
import type { AuditSeal } from "./chain-repo";
import { authorize } from "../identity/policy";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";

export const GENESIS_HASH = createHash("sha256").update("ocop-audit-genesis").digest("hex");
/** Rows younger than this may still belong to transactions that have not committed (ADR 0002). */
export const SEAL_DELAY_MS = 30_000;
const BATCH = 5000;

/** Key-sorted JSON so the same row always hashes the same, whatever order the driver returns keys in. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(",")}}`;
}

export function chainHash(prevHash: string, row: AuditEntry): string {
  return createHash("sha256").update(prevHash).update("\n").update(canonical(row)).digest("hex");
}

const system = (name: string) => ({ kind: "system" as const, name, ctx: { requestId: `job:${name}` } });

/** Worker job, every minute: seals the rows that are old enough, in the order it finds them. */
export function sealAuditBatch(deps: CoreDeps) {
  return () =>
    deps.uow.run(async (tx) => {
      if (!(await tx.auditChain.tryLock())) return { sealed: 0, lastSeq: 0, lastHash: GENESIS_HASH, skipped: true };
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
  | { ok: false; checked: number; brokenAtSeq: number; reason: "hash_mismatch" | "row_missing" | "gap" };

/** Nightly job: recomputes the whole chain; a break is audited and logged for the monitoring stack. */
export function verifyAuditChain(deps: CoreDeps) {
  return async (): Promise<ChainVerification> => {
    let prev = GENESIS_HASH;
    let expectedSeq = 1;
    let checked = 0;
    let result: ChainVerification | null = null;
    for (;;) {
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
      tx.audit.append(auditEntry(system("audit.verify"), deps.ids.next(), deps.clock.now(), { action: "audit.chain.broken", metadata: { ...broken } })),
    );
    return broken;
  };
}

const vnDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(d);

/** Daily job: copies the last sealed hash outside the database, so a DB admin cannot rewrite the whole chain. */
export function anchorAuditChain(deps: CoreDeps) {
  return async () => {
    const last = await deps.uow.run((tx) => tx.auditChain.lastSeal());
    if (!last) return null;
    const now = deps.clock.now();
    const key = `anchors/${vnDate(now)}-${last.seq}.json`;
    const body = JSON.stringify({ lastSeq: last.seq, lastHash: last.hash, sealedAt: last.sealedAt.toISOString(), anchoredAt: now.toISOString() });
    await deps.anchorStore.put(key, body, "application/json");
    await deps.uow.run((tx) =>
      tx.audit.append(auditEntry(system("audit.anchor"), deps.ids.next(), now, { action: "audit.anchored", metadata: { key, lastSeq: last.seq, lastHash: last.hash } })),
    );
    return { key, lastSeq: last.seq, lastHash: last.hash };
  };
}

/** Admin wrappers so the worker's jobs can also be triggered from the UI. */
export function verifyAuditChainAsAdmin(deps: CoreDeps) {
  const verify = verifyAuditChain(deps);
  return async (actor: Actor) => {
    authorize(actor, "audit.search");
    return verify();
  };
}
