import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { emit } from "../platform/emit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { parseQd26File } from "./qd26-file";
import type { CriteriaVersion } from "./version";

export interface ImportVersionInput {
  fileName: string;
  /** The file's text (JSON); small, about 1 MB for QĐ 26. */
  content: string;
}

/** Larger than any foreseeable legal text in this format; refuses oversized bodies before parsing. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/**
 * L19 AD-03: Quản trị imports a Phiên bản tiêu chí from a file in the QĐ 26 extraction format. It always
 * creates a draft, never publishes. A refused file creates nothing and lists every problem with its location.
 * The seed calls it as a system actor.
 */
export function importVersion(deps: CoreDeps) {
  return async (actor: Actor, input: ImportVersionInput) => {
    if (actor.kind !== "system") authorize(actor, "criteria.import");
    if (new TextEncoder().encode(input.content).length > MAX_IMPORT_BYTES) {
      throw new DomainError("file_too_large", "Tệp tiêu chí quá lớn (tối đa 5 MB)");
    }
    const parsed = parseQd26File(input.content, () => deps.ids.next());
    return deps.uow.run(async (tx) => {
      const now = deps.clock.now();
      const version: CriteriaVersion = {
        id: deps.ids.next(),
        legalBasis: parsed.legalBasis,
        issuedOn: parsed.issuedOn,
        effectiveOn: parsed.effectiveOn,
        status: "draft",
        createdAt: now,
        createdBy: actor.kind === "user" ? actor.userId : null,
        publishedAt: null,
        publishedBy: null,
        copiedFrom: null,
      };
      await tx.criteriaVersions.insert(version, parsed.rows);
      const sets = parsed.rows.sets;
      const levels = sets.flatMap((s) => s.levels);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "criteria.version.imported",
          targetType: "criteria_version",
          targetId: version.id,
          after: { legalBasis: version.legalBasis, issuedOn: version.issuedOn, effectiveOn: version.effectiveOn, status: version.status },
          metadata: {
            fileName: input.fileName,
            sets: sets.length,
            criteria: sets.reduce((n, s) => n + s.criteria.length, 0),
            levels: levels.length,
            systemAddedLevels: levels.filter((l) => l.systemAdded).length,
          },
        }),
      );
      await emit(deps, tx, { type: "criteria.version.imported", payload: { versionId: version.id } });
      return { versionId: version.id };
    });
  };
}
