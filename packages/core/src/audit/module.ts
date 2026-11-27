import { defineModule } from "../shared/module";
import { anchorAuditChain, sealAuditBacklog, sealAuditBatch, verifyAuditChain, verifyAuditChainAsAdmin } from "./chain";
import { searchAudit } from "./search";

export const auditModule = defineModule({
  useCases: {
    search: searchAudit,
    seal: sealAuditBatch,
    verify: verifyAuditChain,
    anchor: anchorAuditChain,
    verifyAsAdmin: verifyAuditChainAsAdmin,
  },
  // ADR 0002: seal every minute, verify nightly, anchor the day that ended just after midnight (Vietnam time).
  jobs: {
    // Drain the backlog in batches; each call seals at most one batch.
    "audit.seal": { cron: "* * * * *", run: sealAuditBacklog },
    "audit.verify": { cron: "0 2 * * *", run: verifyAuditChain },
    "audit.anchor": { cron: "5 0 * * *", run: anchorAuditChain },
  },
});
