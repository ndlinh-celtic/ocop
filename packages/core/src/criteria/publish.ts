import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { requireRecentAuth } from "../identity/reauth";
import { emit } from "../platform/emit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import { versionNotFound } from "./helpers";
import { findVersionIssues, type ValidationIssue } from "./validation";
import { assertDraft } from "./version";


/** Publishing was refused because the check still finds problems; `issues` lists all of them. */
export class CriteriaValidationError extends DomainError {
  static override readonly brand = "CriteriaValidationError";

  constructor(readonly issues: ValidationIssue[]) {
    super("validation_failed", `Phiên bản tiêu chí còn ${issues.length} lỗi kiểm tra, chưa phát hành được`);
    this.name = "CriteriaValidationError";
  }
}

/** L19 AD-04: the check of a Phiên bản tiêu chí, every problem at once (spec #16 stories 20-23). Quản trị only. */
export function validateVersion(deps: CoreDeps) {
  return async (actor: Actor, input: { versionId: string }): Promise<{ issues: ValidationIssue[] }> => {
    authorize(actor, "criteria.read_draft");
    return deps.uow.run(async (tx) => {
      assertIdShape(input.versionId, versionNotFound);
      if (!(await tx.criteriaVersions.findById(input.versionId))) throw versionNotFound();
      return { issues: findVersionIssues(await tx.criteriaVersions.loadRows(input.versionId)) };
    });
  };
}

/**
 * L19 AD-04: Quản trị publishes a draft after Xác thực lại. The check runs again inside the publishing
 * transaction, with the version row locked, so what is published is exactly what passed. One way only.
 */
export function publishVersion(deps: CoreDeps) {
  return async (actor: Actor, input: { versionId: string }): Promise<{ versionId: string; publishedAt: Date }> => {
    authorize(actor, "criteria.publish");
    return deps.uow.run(async (tx) => {
      const proof = await requireRecentAuth(deps, tx, actor);
      assertIdShape(input.versionId, versionNotFound);
      const version = await tx.criteriaVersions.lock(input.versionId);
      if (!version) throw versionNotFound();
      assertDraft(version);
      const issues = findVersionIssues(await tx.criteriaVersions.loadRows(version.id));
      if (issues.length > 0) throw new CriteriaValidationError(issues);
      const now = deps.clock.now();
      await tx.criteriaVersions.markPublished(version.id, now, actor.userId);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "criteria.version.published",
          targetType: "criteria_version",
          targetId: version.id,
          before: { status: version.status },
          after: { status: "published", legalBasis: version.legalBasis, publishedAt: now.toISOString() },
          metadata: { reauth: { at: proof.at.toISOString(), method: proof.method } },
        }),
      );
      await emit(deps, tx, { type: "criteria.version.published", payload: { versionId: version.id } });
      return { versionId: version.id, publishedAt: now };
    });
  };
}
