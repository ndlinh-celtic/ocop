import { defineModule } from "../shared/module";
import { anchorAuditChain, sealAuditBatch, verifyAuditChain } from "./chain";

export const auditModule = defineModule({
  // ADR 0002: seal every minute, verify nightly, anchor the day that ended just after midnight (Vietnam time).
  jobs: {
    "audit.seal": {
      cron: "* * * * *",
      run: (deps) => {
        const seal = sealAuditBatch(deps);
        // Drain the backlog in batches; each call seals at most one batch.
        return async (system) => {
          while ((await seal(system)).sealed > 0);
        };
      },
    },
    "audit.verify": { cron: "0 2 * * *", run: verifyAuditChain },
    "audit.anchor": { cron: "5 0 * * *", run: anchorAuditChain },
  },
});
