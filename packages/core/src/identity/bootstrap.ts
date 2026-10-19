import { auditEntry } from "../audit/audit";
import type { RequestContext } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertPasswordAcceptable } from "./password";

export interface BootstrapAdminInput {
  email: string;
  fullName: string;
  password: string;
}

/**
 * Creates the first Quản trị from a command run on the server. There is no default account
 * and no public "create admin" page; once any Quản trị exists this refuses.
 */
export function bootstrapFirstAdmin(deps: CoreDeps) {
  return async (input: BootstrapAdminInput, ctx: RequestContext) => {
    assertPasswordAcceptable(input.password);
    const passwordHash = await deps.hasher.hash(input.password);
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      if (await tx.roleAssignments.existsActiveWithRole("admin", now)) {
        throw new DomainError("admin_already_exists", "Hệ thống đã có Quản trị");
      }
      const userId = deps.ids.next();
      await tx.users.insert({
        id: userId,
        email: input.email.trim(),
        fullName: input.fullName.trim(),
        passwordHash,
        status: "active",
        createdAt: now,
      });
      const assignmentId = deps.ids.next();
      await tx.roleAssignments.insert({
        id: assignmentId,
        userId,
        role: "admin",
        scopeType: "system",
        scopeId: null,
        validFrom: now,
        validTo: null,
        grantedBy: null,
        createdAt: now,
      });
      const system = { kind: "system" as const, name: "bootstrap", ctx };
      await tx.audit.append(
        auditEntry(system, deps.ids.next(), now, {
          action: "identity.admin.bootstrapped",
          targetType: "user",
          targetId: userId,
          after: { email: input.email.trim(), fullName: input.fullName.trim(), assignmentId },
        }),
      );
      return { userId };
    });
  };
}
