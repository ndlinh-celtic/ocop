import { auditEntry } from "../audit/audit";
import type { SystemActor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";

/** ADR 0003: each process records the security-relevant deployment settings it started with. */
export function recordStartup(deps: CoreDeps) {
  return (actor: SystemActor, input: { process: "web" | "worker" }) =>
    deps.uow.run(async (tx) => {
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), deps.clock.now(), {
          action: "system.started",
          metadata: { process: input.process, totpRequired: deps.settings.totpRequired },
        }),
      );
    });
}
