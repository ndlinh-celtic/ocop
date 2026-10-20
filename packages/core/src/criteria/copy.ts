import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { emit } from "../platform/emit";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import { versionNotFound } from "./helpers";
import type { CriteriaVersion, VersionRows } from "./version";

/**
 * The same tree under fresh ids: every row gets a new id from `nextId` and every reference is
 * rewritten to the new id of its target, so nothing in the result points into the source.
 */
export function copyRows(rows: VersionRows, nextId: () => string): VersionRows {
  const ids = new Map<string, string>();
  const fresh = (old: string) => {
    const id = nextId();
    ids.set(old, id);
    return id;
  };
  const to = (old: string) => {
    const id = ids.get(old);
    if (!id) throw new Error(`copyRows: reference to a row outside the tree (${old})`);
    return id;
  };
  const productGroups = rows.productGroups.map((g) => ({ ...g, id: fresh(g.id) }));
  const subgroups = rows.subgroups.map((s) => ({ ...s, id: fresh(s.id), productGroupId: to(s.productGroupId) }));
  const sets = rows.sets.map((s) => {
    const setId = fresh(s.set.id);
    const set = { ...s.set, id: setId, subgroupId: to(s.set.subgroupId), sourcePages: [...s.set.sourcePages] };
    const exclusions = s.exclusions.map((e) => ({ ...e, id: fresh(e.id), setId }));
    const parts = s.parts.map((p) => ({ ...p, id: fresh(p.id), setId }));
    const sections = s.sections.map((m) => ({ ...m, id: fresh(m.id), setId, partId: to(m.partId) }));
    const criterionGroups = s.criterionGroups.map((g) => ({ ...g, id: fresh(g.id), setId, sectionId: to(g.sectionId) }));
    const criteria = s.criteria.map((c) => ({
      ...c,
      id: fresh(c.id),
      setId,
      sectionId: to(c.sectionId),
      groupId: c.groupId === null ? null : to(c.groupId),
    }));
    const levels = s.levels.map((l) => ({ ...l, id: fresh(l.id), setId, criterionId: to(l.criterionId) }));
    return { set, exclusions, parts, sections, criterionGroups, criteria, levels };
  });
  return { thresholds: { ...rows.thresholds }, productGroups, subgroups, sets };
}

/**
 * L19 AD-04: Quản trị creates a new draft by copying a version, draft or published, e.g. to correct an
 * extraction error after publishing. The copy keeps the Văn bản căn cứ and dates, records `copiedFrom`
 * for lookup only (ADR 0006: no inheritance), and shares no row with its source, which is left unchanged.
 */
export function copyVersion(deps: CoreDeps) {
  return async (actor: Actor, input: { versionId: string }): Promise<{ versionId: string }> => {
    authorize(actor, "criteria.copy");
    return deps.uow.run(async (tx) => {
      // The lock gives a consistent snapshot of a draft that someone may be editing.
      assertIdShape(input.versionId, versionNotFound);
      const source = await tx.criteriaVersions.lock(input.versionId);
      if (!source) throw versionNotFound();
      const rows = copyRows(await tx.criteriaVersions.loadRows(source.id), () => deps.ids.next());
      const now = deps.clock.now();
      const version: CriteriaVersion = {
        id: deps.ids.next(),
        legalBasis: source.legalBasis,
        issuedOn: source.issuedOn,
        effectiveOn: source.effectiveOn,
        status: "draft",
        createdAt: now,
        createdBy: actor.userId,
        publishedAt: null,
        publishedBy: null,
        copiedFrom: source.id,
      };
      await tx.criteriaVersions.insert(version, rows);
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "criteria.version.copied",
          targetType: "criteria_version",
          targetId: version.id,
          after: {
            legalBasis: version.legalBasis,
            issuedOn: version.issuedOn,
            effectiveOn: version.effectiveOn,
            status: version.status,
            copiedFrom: source.id,
          },
          metadata: { sourceStatus: source.status, sets: rows.sets.length, criteria: rows.sets.reduce((n, s) => n + s.criteria.length, 0) },
        }),
      );
      await emit(deps, tx, { type: "criteria.version.copied", payload: { versionId: version.id, copiedFrom: source.id } });
      return { versionId: version.id };
    });
  };
}

/**
 * L19 AD-04: Quản trị deletes a draft no longer needed, with its whole tree (the DB cascades).
 * A published version is never deleted: the domain refuses here and the trigger of 0011 refuses below.
 */
export function deleteVersion(deps: CoreDeps) {
  return async (actor: Actor, input: { versionId: string }): Promise<void> => {
    authorize(actor, "criteria.delete");
    return deps.uow.run(async (tx) => {
      assertIdShape(input.versionId, versionNotFound);
      const version = await tx.criteriaVersions.lock(input.versionId);
      if (!version) throw versionNotFound();
      if (version.status !== "draft") throw new DomainError("version_published", "Phiên bản tiêu chí đã phát hành, không xóa được");
      const rows = await tx.criteriaVersions.loadRows(version.id);
      await tx.criteriaVersions.delete(version.id);
      const now = deps.clock.now();
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "criteria.version.deleted",
          targetType: "criteria_version",
          targetId: version.id,
          before: {
            legalBasis: version.legalBasis,
            issuedOn: version.issuedOn,
            effectiveOn: version.effectiveOn,
            status: version.status,
            copiedFrom: version.copiedFrom,
          },
          metadata: { sets: rows.sets.length, criteria: rows.sets.reduce((n, s) => n + s.criteria.length, 0) },
        }),
      );
      await emit(deps, tx, { type: "criteria.version.deleted", payload: { versionId: version.id } });
    });
  };
}
