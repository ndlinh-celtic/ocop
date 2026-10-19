import { auditEntry } from "../audit/audit";
import type { RequestContext } from "../shared/context";
import type { CoreDeps } from "../shared/deps";

/** ADR 0003: each process records the security-relevant deployment settings it started with. */
export function recordStartup(deps: CoreDeps) {
  return (processName: "web" | "worker", ctx: RequestContext) =>
    deps.uow.run(async (tx) => {
      const actor = { kind: "system" as const, name: processName, ctx };
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), deps.clock.now(), {
          action: "system.started",
          metadata: { process: processName, totpRequired: deps.settings.totpRequired },
        }),
      );
    });
}
