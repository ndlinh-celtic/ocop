// The public interface of the audit module: what apps/web, apps/worker and packages/infra may use, re-exported by src/index.ts.
export type { AuditEntry, AuditFilter, AuditLog } from "./audit";
export { chainHash, GENESIS_HASH, SEAL_DELAY_MS, type ChainVerification } from "./chain";
export type { AuditChainRepo, AuditSeal } from "./chain-repo";
