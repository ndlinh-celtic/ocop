import { authorize, can } from "../identity/policy";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { assertIdShape } from "../shared/ids";
import { assembleSet, type CriteriaSetDetail } from "./detail";
import { byPosition, setNotFound, versionNotFound } from "./helpers";
import type { RankThresholds } from "./model";
import type { CriteriaVersion, VersionSummary, VersionTaxonomy } from "./version";

/*
 * Reading Phiên bản tiêu chí: any signed-in Người dùng sees published versions; only Quản trị sees drafts
 * (spec #16 story 33). A draft is reported as not found to everyone else.
 */

export interface TaxonomySet {
  id: string;
  code: string;
  name: string;
  totalPoints: number;
  criterionCount: number;
}

export interface TaxonomySubgroup {
  id: string;
  name: string;
  sets: TaxonomySet[];
}

export interface TaxonomyGroup {
  id: string;
  name: string;
  subgroups: TaxonomySubgroup[];
}

export interface VersionDetail extends CriteriaVersion {
  thresholds: RankThresholds;
  /** Cây phân loại: Nhóm sản phẩm → Phân nhóm → Bộ tiêu chí, in display order. */
  productGroups: TaxonomyGroup[];
}

export interface CriteriaSetView {
  version: Pick<CriteriaVersion, "id" | "legalBasis" | "status">;
  thresholds: RankThresholds;
  productGroup: string;
  subgroup: string;
  set: CriteriaSetDetail;
}

/** Cây phân loại of a version: Nhóm sản phẩm → Phân nhóm → Bộ tiêu chí, in display order. */
export function taxonomyTree(t: VersionTaxonomy): TaxonomyGroup[] {
  return byPosition(t.productGroups).map((g) => ({
    id: g.id,
    name: g.name,
    subgroups: byPosition(t.subgroups.filter((s) => s.productGroupId === g.id)).map((s) => ({
      id: s.id,
      name: s.name,
      sets: byPosition(t.sets.filter((b) => b.subgroupId === s.id)).map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        totalPoints: b.totalPoints,
        criterionCount: b.criterionCount,
      })),
    })),
  }));
}

const visible = (actor: Actor, v: CriteriaVersion) => v.status === "published" || can(actor, "criteria.read_draft");

export function listVersions(deps: CoreDeps) {
  return async (actor: Actor): Promise<VersionSummary[]> => {
    authorize(actor, "criteria.read_published");
    const all = can(actor, "criteria.read_draft");
    return deps.uow.run((tx) => tx.criteriaVersions.list(all ? {} : { status: "published" }));
  };
}

export function getVersion(deps: CoreDeps) {
  return async (actor: Actor, input: { versionId: string }): Promise<VersionDetail> => {
    authorize(actor, "criteria.read_published");
    return deps.uow.run(async (tx) => {
      assertIdShape(input.versionId, versionNotFound);
      const version = await tx.criteriaVersions.findById(input.versionId);
      if (!version || !visible(actor, version)) throw versionNotFound();
      const t = await tx.criteriaVersions.taxonomy(version.id);
      return {
        ...version,
        thresholds: t.thresholds,
        productGroups: taxonomyTree(t),
      };
    });
  };
}

export function getCriteriaSet(deps: CoreDeps) {
  return async (actor: Actor, input: { setId: string }): Promise<CriteriaSetView> => {
    authorize(actor, "criteria.read_published");
    return deps.uow.run(async (tx) => {
      assertIdShape(input.setId, setNotFound);
      const found = await tx.criteriaVersions.findSet(input.setId);
      const version = found && (await tx.criteriaVersions.findById(found.versionId));
      if (!found || !version || !visible(actor, version)) throw setNotFound();
      const subgroup = (await tx.criteriaVersions.findNode("subgroup", found.rows.set.subgroupId))?.row;
      const group = subgroup && (await tx.criteriaVersions.findNode("productGroup", subgroup.productGroupId))?.row;
      return {
        version: { id: version.id, legalBasis: version.legalBasis, status: version.status },
        thresholds: await tx.criteriaVersions.thresholds(version.id),
        productGroup: group?.name ?? "",
        subgroup: subgroup?.name ?? "",
        set: assembleSet(found.rows),
      };
    });
  };
}
